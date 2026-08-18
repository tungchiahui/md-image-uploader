const assert = require('node:assert/strict');
const { statSync } = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const sharp = require('sharp');

const iconPath = path.join(__dirname, '..', 'assets', 'icon.png');

test('extension icon is an optimized 128x128 PNG with alpha', async () => {
  const metadata = await sharp(iconPath).metadata();

  assert.equal(metadata.format, 'png');
  assert.equal(metadata.width, 128);
  assert.equal(metadata.height, 128);
  assert.equal(metadata.hasAlpha, true);
  assert.ok(statSync(iconPath).size < 100 * 1024);
});

test('extension icon has genuinely transparent outer corners', async () => {
  const image = sharp(iconPath).ensureAlpha();
  const corners = await Promise.all([
    image.clone().extract({ left: 0, top: 0, width: 1, height: 1 }).raw().toBuffer(),
    image.clone().extract({ left: 127, top: 0, width: 1, height: 1 }).raw().toBuffer(),
    image.clone().extract({ left: 0, top: 127, width: 1, height: 1 }).raw().toBuffer(),
    image.clone().extract({ left: 127, top: 127, width: 1, height: 1 }).raw().toBuffer(),
  ]);

  assert.deepEqual(corners.map((pixel) => pixel[3]), [0, 0, 0, 0]);
});
