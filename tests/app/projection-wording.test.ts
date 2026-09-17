import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { project3, affineMixture, probabilitySimplex, tetrahedron } from '../../app/spatial/geometry.js';

test('MLR-01 project3 transform and rendering claims use fixed oblique linear screen projection with disclosures', () => {
  const geometrySource = readFileSync(new URL('../../app/spatial/geometry.ts', import.meta.url), 'utf8');
  const inspectorSource = readFileSync(new URL('../../app/spatial/inspector.ts', import.meta.url), 'utf8');
  const sceneSource = readFileSync(new URL('../../app/spatial/scene.ts', import.meta.url), 'utf8');

  // Verify docstring on project3
  assert.match(geometrySource, /Fixed oblique linear screen projection of 3D geometry/);
  assert.match(geometrySource, /screen distances and angles may be distorted/);
  assert.match(geometrySource, /original-space values and arithmetic remain authoritative/);

  // Verify docstring on simplexGlyph
  assert.match(sceneSource, /Fixed oblique linear screen projection of 3D tetrahedron coordinates/);

  // Verify inspector source uses fixed oblique linear screen projection for project3 displays
  assert.match(inspectorSource, /Fixed oblique linear screen projection/);
  assert.match(inspectorSource, /Regular 3D tetrahedron, fixed oblique linear screen projection/);
  assert.match(inspectorSource, /Screen geometry is a display transform/);
  assert.match(inspectorSource, /screen distances and angles may be distorted/);
  assert.match(inspectorSource, /original-space values\/arithmetic remain authoritative/);

  // Narrow check: the project3 / mixture / tetrahedron rendering claims specifically do not claim orthographic
  const mixtureSectionMatch = inspectorSource.match(/function mixture\([\s\S]*?^}/m);
  assert.ok(mixtureSectionMatch, 'mixture function should exist');
  assert.doesNotMatch(mixtureSectionMatch[0], /orthographic/i, 'mixture display transform claims must not claim orthographic geometry');

  const simplexGlyphSectionMatch = inspectorSource.match(/simplexGlyph[\s\S]*?Point = Σ probability × vertex/);
  assert.ok(simplexGlyphSectionMatch, 'simplexGlyph rendering section should exist');
  assert.doesNotMatch(simplexGlyphSectionMatch[0], /orthographic/i, 'simplex glyph display transform claims must not claim orthographic geometry');

  // Verify project3 calculation remains exact
  assert.deepEqual(project3([10, 20, 30]), [10 - 0.55 * 30, -20 + 0.35 * 30]);
  assert.deepEqual(project3([0, 0, 0]), [0, 0]);
  assert.deepEqual(project3([1, 0, 0]), [1, 0]);
  assert.deepEqual(project3([0, 1, 0]), [0, -1]);
  assert.deepEqual(project3([0, 0, 1]), [-0.55, 0.35]);

  // Verify probability simplex and affine mixture arithmetic
  const simplex = probabilitySimplex([0.25, 0.25, 0.25, 0.25]);
  assert.deepEqual(simplex.point, [0, 0, 0]);
  const mix = affineMixture([[1, 2, 3], [4, 5, 6]], [0.5, 0.5]);
  assert.deepEqual(mix.mixture, [2.5, 3.5, 4.5]);
  assert.equal(tetrahedron.length, 4);
});

