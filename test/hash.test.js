const assert = require('node:assert/strict');
const { execFile } = require('node:child_process');
const { mkdtemp, rm, writeFile } = require('node:fs/promises');
const { tmpdir } = require('node:os');
const { join } = require('node:path');
const { promisify } = require('node:util');
const test = require('node:test');

const sharp = require('sharp');

const { hashFinalWebp } = require('../dist/hash.js');
const { convertToWebp } = require('../dist/imageConverter.js');
const { buildObjectKey } = require('../dist/objectKey.js');

const execFileAsync = promisify(execFile);

async function createPng() {
  return sharp({
    create: {
      width: 8,
      height: 6,
      channels: 3,
      background: { r: 12, g: 34, b: 56 },
    },
  })
    .png()
    .toBuffer();
}

test('returns lowercase SHA-256 and its first eight characters', async () => {
  const originalPng = await createPng();
  const finalWebpBuffer = await convertToWebp(originalPng, { quality: 85 });
  const result = hashFinalWebp(finalWebpBuffer);

  assert.match(result.fullHash, /^[0-9a-f]{64}$/);
  assert.equal(result.hash8, result.fullHash.slice(0, 8));
});

test(
  'hash of final WebP bytes matches sha256sum output exactly',
  { skip: process.platform === 'win32' },
  async () => {
    const temporaryDirectory = await mkdtemp(
      join(tmpdir(), 'md-image-uploader-'),
    );
    const outputPath = join(temporaryDirectory, 'test-output.webp');

    try {
      const originalPng = await createPng();
      const finalWebpBuffer = await convertToWebp(originalPng, { quality: 85 });
      const result = hashFinalWebp(finalWebpBuffer);

      await writeFile(outputPath, finalWebpBuffer);
      const { stdout } = await execFileAsync('sha256sum', [outputPath]);
      const commandLineHash = stdout.trim().split(/\s+/, 1)[0];

      assert.equal(commandLineHash, result.fullHash);
    } finally {
      await rm(temporaryDirectory, { recursive: true, force: true });
    }
  },
);

test('hashes the converted WebP rather than the original image bytes', async () => {
  const originalPng = await createPng();
  const finalWebpBuffer = await convertToWebp(originalPng, { quality: 85 });

  assert.notEqual(
    hashFinalWebp(originalPng).fullHash,
    hashFinalWebp(finalWebpBuffer).fullHash,
  );
});

test('uses the final WebP hash prefix in the object filename', async () => {
  const originalPng = await createPng();
  const finalWebpBuffer = await convertToWebp(originalPng, { quality: 85 });
  const { hash8 } = hashFinalWebp(finalWebpBuffer);
  const objectKey = buildObjectKey({
    uploadPath: 'wiki',
    date: { year: 2026, month: 8, day: 18 },
    timestamp: 1787039123456,
    hash8,
  });

  assert.equal(
    objectKey,
    `wiki/2026/08/18/1787039123456-${hash8}.webp`,
  );
});
