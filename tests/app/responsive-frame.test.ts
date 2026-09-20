import test from 'node:test';
import assert from 'node:assert/strict';
import { responsivePublicFrame, PUBLIC_CONTENT_BOUNDS } from '../../app/spatial/camera.js';

test('responsivePublicFrame: returns bounds safely for zero or negative dimensions', () => {
  assert.deepEqual(responsivePublicFrame(0, 0), PUBLIC_CONTENT_BOUNDS);
  assert.deepEqual(responsivePublicFrame(-100, 500), PUBLIC_CONTENT_BOUNDS);
  assert.deepEqual(responsivePublicFrame(500, -100), PUBLIC_CONTENT_BOUNDS);
});

test('responsivePublicFrame: matches container aspect ratio exactly on 16:10 viewports', () => {
  const containerW = 1408;
  const containerH = 647;
  const frame = responsivePublicFrame(containerW, containerH);

  // Content width must not be cropped
  assert.equal(frame.width, PUBLIC_CONTENT_BOUNDS.width);
  assert.equal(frame.x, PUBLIC_CONTENT_BOUNDS.x);

  // Height must expand to match container aspect ratio without non-uniform stretching
  const frameAspect = frame.width / frame.height;
  const containerAspect = containerW / containerH;
  assert.ok(Math.abs(frameAspect - containerAspect) < 0.01, `frameAspect ${frameAspect} matches containerAspect ${containerAspect}`);

  // Frame must vertically center the content
  assert.ok(frame.y < PUBLIC_CONTENT_BOUNDS.y, 'frame.y extends above content bounds to center');
  const contentCenterY = PUBLIC_CONTENT_BOUNDS.y + PUBLIC_CONTENT_BOUNDS.height / 2;
  const frameCenterY = frame.y + frame.height / 2;
  assert.ok(Math.abs(frameCenterY - contentCenterY) <= 1, 'content is vertically centered within camera frame');

  // Complete public content must be fully enclosed
  assert.ok(frame.x <= PUBLIC_CONTENT_BOUNDS.x);
  assert.ok(frame.y <= PUBLIC_CONTENT_BOUNDS.y);
  assert.ok(frame.x + frame.width >= PUBLIC_CONTENT_BOUNDS.x + PUBLIC_CONTENT_BOUNDS.width);
  assert.ok(frame.y + frame.height >= PUBLIC_CONTENT_BOUNDS.y + PUBLIC_CONTENT_BOUNDS.height);
});

test('responsivePublicFrame: matches container aspect ratio on wide viewports without cropping', () => {
  const containerW = 3408;
  const containerH = 800; // aspect = 4.26 > 3.5
  const frame = responsivePublicFrame(containerW, containerH);

  // Height is preserved
  assert.equal(frame.height, PUBLIC_CONTENT_BOUNDS.height);
  assert.equal(frame.y, PUBLIC_CONTENT_BOUNDS.y);

  // Width expands to match container aspect ratio
  const frameAspect = frame.width / frame.height;
  const containerAspect = containerW / containerH;
  assert.ok(Math.abs(frameAspect - containerAspect) < 0.01);

  // Horizontally centered
  const contentCenterX = PUBLIC_CONTENT_BOUNDS.x + PUBLIC_CONTENT_BOUNDS.width / 2;
  const frameCenterX = frame.x + frame.width / 2;
  assert.ok(Math.abs(frameCenterX - contentCenterX) <= 1);
});
