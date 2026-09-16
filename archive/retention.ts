import { measurePortableArchive, PORTABLE_ARCHIVE_LIMITS, type PortableArchiveMeasurement } from './portable.js';
import { SessionArchive } from './session.js';
import { MAX_RECORD_BYTES, MAX_RETAINED_CODEC_METADATA_BYTES, MAX_VALUES } from '../trace/evidence.js';

const MIB = 1024 * 1024;
const EVIDENCE_PORTABLE_BOUND = Math.ceil((MAX_RECORD_BYTES + MAX_RETAINED_CODEC_METADATA_BYTES + MAX_VALUES * 8 + 64 * 1024) / MIB) * MIB + 2 * MIB;

interface ReservationBound {
  readonly bytes: number;
  readonly manifestDataNodes: number;
  readonly payloadEntries?: number;
  readonly uniquePayloadBytes?: number;
  readonly snapshots?: number;
  readonly directRuns?: number;
  readonly learningExperiments?: number;
  readonly interventionExperiments?: number;
  readonly modelVariantExperiments?: number;
  readonly dataExperiments?: number;
  readonly evidenceEntries?: number;
}

/**
 * Conservative per-operation additions to the exact portable-v1 footprint.
 * Native/import derives from the producer envelope, retained metadata, the largest
 * qualified float64 payload, and framing. Fixed canonical and experiment families
 * use their registered bounded producers; the larger experiment bound contains the
 * complete qualified M3 portfolio family contribution.
 */
export const RETENTION_RESERVATION_BOUNDS = Object.freeze({
  canonical: Object.freeze({bytes:8*MIB,manifestDataNodes:120_000,snapshots:2,directRuns:4,learningExperiments:1}),
  nativeEvidence: Object.freeze({bytes:EVIDENCE_PORTABLE_BOUND,manifestDataNodes:250_000,payloadEntries:2048,uniquePayloadBytes:MAX_VALUES*8,evidenceEntries:1}),
  standaloneImport: Object.freeze({bytes:EVIDENCE_PORTABLE_BOUND,manifestDataNodes:250_000,payloadEntries:2048,uniquePayloadBytes:MAX_VALUES*8,evidenceEntries:1}),
  intervention: Object.freeze({bytes:16*MIB,manifestDataNodes:300_000,directRuns:3,interventionExperiments:1}),
  modelVariant: Object.freeze({bytes:16*MIB,manifestDataNodes:300_000,directRuns:1,modelVariantExperiments:1}),
  dataExperiment: Object.freeze({bytes:16*MIB,manifestDataNodes:600_000,snapshots:32,directRuns:64,learningExperiments:16,dataExperiments:1}),
});
export const RETENTION_RESERVATION_BYTES = Object.freeze(Object.fromEntries(Object.entries(RETENTION_RESERVATION_BOUNDS).map(([key,value])=>[key,value.bytes])) as Record<keyof typeof RETENTION_RESERVATION_BOUNDS,number>);

export type RetentionOperation = keyof typeof RETENTION_RESERVATION_BOUNDS;

export interface RetentionStatus {
  readonly retained: PortableArchiveMeasurement;
  readonly hardLimitBytes: number;
  readonly reservedBytes: number;
  readonly reservationCount: number;
  readonly remainingBytes: number;
  readonly remainingManifestDataNodes: number;
  readonly blocked: boolean;
  readonly generation: number;
}

export class RetentionCapacityError extends Error {
  constructor(readonly requestedBytes: number, readonly availableBytes: number, detail?: string) {
    super(`Retention capacity exceeded: ${detail??`operation requires ${(requestedBytes / MIB).toFixed(1)} MiB; ${(Math.max(0, availableBytes) / MIB).toFixed(1)} MiB remains`}`);
    this.name = 'RetentionCapacityError';
  }
}

class Reservation {
  active = true;
  constructor(
    readonly id: number,
    readonly generation: number,
    readonly operation: RetentionOperation,
    readonly bound: ReservationBound,
    readonly baselineBytes: number,
    readonly baseArchive: SessionArchive,
  ) {}
}

export interface RetentionTransaction {
  readonly archive: SessionArchive;
  readonly operation: RetentionOperation;
  readonly reservedBytes: number;
  commit(): Promise<RetentionStatus>;
  cancel(): void;
}

/** Session-scoped durable authority. Reservations are transaction state, never evidence. */
export class SessionRetention {
  #archive: SessionArchive;
  #measurement?: PortableArchiveMeasurement;
  #generation = 0;
  #sequence = 0;
  readonly #reservations = new Map<number, Reservation>();

  constructor(archive: SessionArchive) { this.#archive = archive; }
  get archive(): SessionArchive { return this.#archive; }

  async synchronize(): Promise<RetentionStatus> {
    this.#measurement = await measurePortableArchive(this.#archive);
    return this.status();
  }

  status(): RetentionStatus {
    if (!this.#measurement) throw new Error('Retention authority has not been synchronized');
    const reservedBytes = [...this.#reservations.values()].filter(value => value.active).reduce((sum, value) => sum + value.bound.bytes, 0);
    const reservedNodes = [...this.#reservations.values()].filter(value => value.active).reduce((sum, value) => sum + value.bound.manifestDataNodes, 0);
    const remainingBytes = PORTABLE_ARCHIVE_LIMITS.archiveBytes - this.#measurement.archiveBytes - reservedBytes;
    const remainingManifestDataNodes = PORTABLE_ARCHIVE_LIMITS.dataNodes - this.#measurement.manifestDataNodes - reservedNodes;
    return Object.freeze({retained:this.#measurement,hardLimitBytes:PORTABLE_ARCHIVE_LIMITS.archiveBytes,reservedBytes,
      reservationCount:[...this.#reservations.values()].filter(value=>value.active).length,remainingBytes:Math.max(0,remainingBytes),
      remainingManifestDataNodes:Math.max(0,remainingManifestDataNodes),blocked:remainingBytes<=0||remainingManifestDataNodes<=0,generation:this.#generation});
  }

  async begin(operation: RetentionOperation): Promise<RetentionTransaction> {
    await this.synchronize();
    const bound = RETENTION_RESERVATION_BOUNDS[operation], status = this.status();
    const failure=this.#capacityFailure(bound);
    if (failure) throw new RetentionCapacityError(bound.bytes, status.remainingBytes, failure);
    const reservation = new Reservation(++this.#sequence, this.#generation, operation, bound,
      status.retained.archiveBytes, this.#archive);
    this.#reservations.set(reservation.id, reservation);
    try {
      const candidate = await this.#archive.fork();
      const authority = this;
      return Object.freeze({archive:candidate,operation,reservedBytes:bound.bytes,
        commit:()=>authority.#commit(reservation,candidate),cancel:()=>authority.#cancel(reservation)});
    } catch (error) {
      this.#cancel(reservation);
      throw error;
    }
  }

  async replace(archive: SessionArchive): Promise<RetentionStatus> {
    this.#invalidate();
    this.#archive = archive;
    this.#measurement = await measurePortableArchive(archive);
    return this.status();
  }

  #cancel(reservation: Reservation): void {
    if (!reservation.active) return;
    reservation.active = false;
    this.#reservations.delete(reservation.id);
  }

  async #commit(reservation: Reservation, candidate: SessionArchive): Promise<RetentionStatus> {
    if (!reservation.active || reservation.generation !== this.#generation || reservation.baseArchive !== this.#archive) {
      this.#cancel(reservation);
      throw new Error('Stale retention reservation');
    }
    try {
      const measurement = await measurePortableArchive(candidate);
      if (!reservation.active || reservation.generation !== this.#generation || reservation.baseArchive !== this.#archive)
        throw new Error('Stale retention reservation');
      const growth = Math.max(0, measurement.archiveBytes - reservation.baselineBytes);
      const before=this.#measurement!,recordGrowth=(key:keyof PortableArchiveMeasurement['records'])=>measurement.records[key]-before.records[key];
      if (growth > reservation.bound.bytes || measurement.manifestDataNodes-before.manifestDataNodes > reservation.bound.manifestDataNodes ||
          measurement.payloadEntries-before.payloadEntries>(reservation.bound.payloadEntries??0) || measurement.uniquePayloadBytes-before.uniquePayloadBytes>(reservation.bound.uniquePayloadBytes??0) ||
          recordGrowth('snapshots')>(reservation.bound.snapshots??0) || recordGrowth('directRuns')>(reservation.bound.directRuns??0) ||
          recordGrowth('learningExperiments')>(reservation.bound.learningExperiments??0) || recordGrowth('interventionExperiments')>(reservation.bound.interventionExperiments??0) ||
          recordGrowth('modelVariantExperiments')>(reservation.bound.modelVariantExperiments??0) || recordGrowth('dataExperiments')>(reservation.bound.dataExperiments??0) ||
          recordGrowth('evidenceEntries')>(reservation.bound.evidenceEntries??0))
        throw new Error(`Retention producer exceeded its declared ${reservation.operation} bound`);
      if (measurement.archiveBytes > PORTABLE_ARCHIVE_LIMITS.archiveBytes)
        throw new RetentionCapacityError(growth, PORTABLE_ARCHIVE_LIMITS.archiveBytes - reservation.baselineBytes);
      this.#archive = candidate;
      this.#measurement = measurement;
      this.#cancel(reservation);
      return this.status();
    } finally {
      this.#cancel(reservation);
    }
  }

  #invalidate(): void {
    this.#generation++;
    for (const reservation of this.#reservations.values()) reservation.active = false;
    this.#reservations.clear();
  }

  #capacityFailure(bound: ReservationBound): string | undefined {
    if (!this.#measurement) return 'retention measurement is unavailable';
    const active=[...this.#reservations.values()].filter(value=>value.active).map(value=>value.bound);
    const total=(key:keyof ReservationBound)=>active.reduce((sum,value)=>sum+(value[key]??0),0)+(bound[key]??0);
    const records=this.#measurement.records;
    const checks:[number,number,string][]=[
      [this.#measurement.archiveBytes+total('bytes'),PORTABLE_ARCHIVE_LIMITS.archiveBytes,'portable archive bytes'],
      [this.#measurement.manifestDataNodes+total('manifestDataNodes'),PORTABLE_ARCHIVE_LIMITS.dataNodes,'manifest data nodes'],
      [this.#measurement.payloadEntries+total('payloadEntries'),PORTABLE_ARCHIVE_LIMITS.payloadEntries,'payload entries'],
      [this.#measurement.uniquePayloadBytes+total('uniquePayloadBytes'),PORTABLE_ARCHIVE_LIMITS.totalPayloadBytes,'unique payload bytes'],
      [records.snapshots+total('snapshots'),PORTABLE_ARCHIVE_LIMITS.snapshots,'snapshots'],[records.directRuns+total('directRuns'),PORTABLE_ARCHIVE_LIMITS.directRuns,'direct runs'],
      [records.learningExperiments+total('learningExperiments'),PORTABLE_ARCHIVE_LIMITS.learningExperiments,'learning experiments'],
      [records.interventionExperiments+total('interventionExperiments'),PORTABLE_ARCHIVE_LIMITS.interventionExperiments,'intervention experiments'],
      [records.modelVariantExperiments+total('modelVariantExperiments'),PORTABLE_ARCHIVE_LIMITS.modelVariantExperiments,'model-variant experiments'],
      [records.dataExperiments+total('dataExperiments'),PORTABLE_ARCHIVE_LIMITS.dataExperiments,'data experiments'],[records.evidenceEntries+total('evidenceEntries'),PORTABLE_ARCHIVE_LIMITS.evidenceEntries,'standalone evidence entries'],
    ];
    const failed=checks.find(([used,limit])=>used>limit);return failed?`${failed[2]} reservation would use ${failed[0].toLocaleString()} of ${failed[1].toLocaleString()}`:undefined;
  }
}
