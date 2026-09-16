const encoder = new TextEncoder();

export interface CacheStatus {
  readonly entries: number;
  readonly bytes: number;
  readonly maxEntries: number;
  readonly maxBytes: number;
  readonly pendingBytes: number;
  readonly evictions: number;
}

interface Entry<V> { readonly value: V; readonly bytes: number }

export interface CacheReservation<V> {
  readonly bytes: number;
  commit(value: V): boolean;
  cancel(): void;
}

/** Deterministic byte-accounted LRU for derived/recomputable presentation state. */
export class BoundedCache<K, V> {
  readonly #entries = new Map<K, Entry<V>>();
  readonly #pending = new Map<number, number>();
  #sequence = 0;
  #generation = 0;
  #bytes = 0;
  #evictions = 0;
  constructor(readonly maxEntries: number, readonly maxBytes: number, readonly maxEntryBytes: number) {
    if (!Number.isSafeInteger(maxEntries) || maxEntries < 1 || !Number.isSafeInteger(maxBytes) || maxBytes < 1 ||
        !Number.isSafeInteger(maxEntryBytes) || maxEntryBytes < 1 || maxEntryBytes > maxBytes) throw new Error('Invalid bounded-cache policy');
  }

  get(key: K): V | undefined {
    const entry = this.#entries.get(key);
    if (!entry) return undefined;
    this.#entries.delete(key); this.#entries.set(key, entry);
    return entry.value;
  }

  reserve(key: K, bytes = this.maxEntryBytes): CacheReservation<V> | undefined {
    if (!Number.isSafeInteger(bytes) || bytes < 0 || bytes > this.maxEntryBytes) return undefined;
    while (this.#entries.size && (this.#entries.size >= this.maxEntries || this.#bytes + this.#pendingBytes() + bytes > this.maxBytes)) this.#evictOldest();
    if (this.#entries.size >= this.maxEntries || this.#bytes + this.#pendingBytes() + bytes > this.maxBytes) return undefined;
    const id = ++this.#sequence, generation = this.#generation; this.#pending.set(id, bytes); let active = true;
    const cancel = () => { if (!active) return; active = false; this.#pending.delete(id); };
    return Object.freeze({bytes, cancel, commit:(value:V)=>{
      if (!active || generation !== this.#generation || !this.#pending.has(id)) { cancel(); return false; }
      const encoded = encoder.encode(JSON.stringify(value)).length;
      if (encoded > bytes) { cancel(); return false; }
      cancel();
      while (this.#entries.size && (this.#entries.size >= this.maxEntries || this.#bytes + encoded > this.maxBytes)) this.#evictOldest();
      if (this.#entries.size >= this.maxEntries || this.#bytes + encoded > this.maxBytes) return false;
      return this.#insert(key, value, encoded);
    }});
  }

  clear(): void {
    this.#generation++;
    this.#entries.clear(); this.#pending.clear(); this.#bytes = 0; this.#evictions = 0;
  }

  status(): CacheStatus { return Object.freeze({entries:this.#entries.size,bytes:this.#bytes,maxEntries:this.maxEntries,maxBytes:this.maxBytes,
    pendingBytes:this.#pendingBytes(),evictions:this.#evictions}); }

  #insert(key: K, value: V, bytes: number): boolean {
    const previous = this.#entries.get(key);
    if (previous) { this.#entries.delete(key); this.#bytes -= previous.bytes; }
    this.#entries.set(key, {value,bytes}); this.#bytes += bytes; return true;
  }

  #pendingBytes(): number { return [...this.#pending.values()].reduce((sum, value) => sum + value, 0); }
  #evictOldest(): void {
    const first = this.#entries.keys().next(); if (first.done) return;
    const entry = this.#entries.get(first.value)!; this.#entries.delete(first.value); this.#bytes -= entry.bytes; this.#evictions++;
  }
}
