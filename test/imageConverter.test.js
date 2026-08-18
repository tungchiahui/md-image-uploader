const assert = require('node:assert/strict');
const test = require('node:test');

const sharp = require('sharp');

const {
  ImageConversionError,
  SUPPORTED_IMAGE_MIME_TYPES,
  UnsupportedImageFormatError,
  convertToWebp,
  isSupportedImageMimeType,
} = require('../dist/imageConverter.js');

const stillFormats = ['png', 'jpeg', 'webp', 'gif', 'avif', 'tiff'];

async function createStillImage(format) {
  const image = sharp({
    create: {
      width: 8,
      height: 6,
      channels: 4,
      background: { r: 32, g: 128, b: 224, alpha: 0.75 },
    },
  });

  switch (format) {
    case 'png':
      return image.png().toBuffer();
    case 'jpeg':
      return image.jpeg().toBuffer();
    case 'webp':
      return image.webp().toBuffer();
    case 'gif':
      return image.gif().toBuffer();
    case 'avif':
      return image.avif().toBuffer();
    case 'tiff':
      return image.tiff().toBuffer();
    default:
      throw new Error(`Unexpected test format: ${format}`);
  }
}

async function createAnimatedGif() {
  const frames = ['#ff0000', '#00ff00', '#0000ff'].map((background) => ({
    create: {
      width: 6,
      height: 4,
      channels: 4,
      background,
    },
  }));

  return sharp(frames, { join: { animated: true } })
    .gif({ delay: [40, 60, 80], loop: 0 })
    .toBuffer();
}

for (const format of stillFormats) {
  test(`converts ${format.toUpperCase()} input to WebP`, async () => {
    const inputBuffer = await createStillImage(format);
    const finalWebpBuffer = await convertToWebp(inputBuffer, { quality: 85 });
    const metadata = await sharp(finalWebpBuffer).metadata();

    assert.equal(Buffer.isBuffer(finalWebpBuffer), true);
    assert.equal(metadata.format, 'webp');
    assert.equal(metadata.width, 8);
    assert.equal(metadata.height, 6);
  });
}

test('preserves all frames when converting animated GIF to animated WebP', async () => {
  const animatedGif = await createAnimatedGif();
  const inputMetadata = await sharp(animatedGif, { animated: true }).metadata();
  const finalWebpBuffer = await convertToWebp(animatedGif, { quality: 85 });
  const outputImage = sharp(finalWebpBuffer, { animated: true });
  const outputMetadata = await outputImage.metadata();
  const { data, info } = await outputImage.raw().toBuffer({
    resolveWithObject: true,
  });

  assert.equal(inputMetadata.pages, 3);
  assert.equal(outputMetadata.format, 'webp');
  assert.equal(outputMetadata.pages, 3);
  assert.equal(outputMetadata.pageHeight, 4);
  assert.deepEqual(outputMetadata.delay, [40, 60, 80]);
  assert.equal(outputMetadata.loop, 0);

  const framePixels = [0, 1, 2].map((frameIndex) => {
    const offset = frameIndex * 4 * info.width * info.channels;
    return [...data.subarray(offset, offset + 3)];
  });

  assert.notDeepEqual(framePixels[0], framePixels[1]);
  assert.notDeepEqual(framePixels[1], framePixels[2]);
});

test('supports exactly the required V1 image MIME types', () => {
  assert.deepEqual(SUPPORTED_IMAGE_MIME_TYPES, [
    'image/png',
    'image/jpeg',
    'image/gif',
    'image/webp',
    'image/avif',
    'image/tiff',
  ]);
  assert.equal(isSupportedImageMimeType('IMAGE/PNG'), true);
  assert.equal(isSupportedImageMimeType('image/jpeg; charset=binary'), true);
  assert.equal(isSupportedImageMimeType('image/svg+xml'), false);
  assert.equal(isSupportedImageMimeType('text/plain'), false);
});

test('rejects supported-by-Sharp formats outside the required V1 set', async () => {
  const svg = Buffer.from(
    '<svg xmlns="http://www.w3.org/2000/svg" width="2" height="2"></svg>',
  );

  await assert.rejects(
    () => convertToWebp(svg, { quality: 85 }),
    (error) =>
      error instanceof UnsupportedImageFormatError &&
      error.mediaType === 'image/svg+xml',
  );
});

test('wraps image decoding failures without swallowing the Sharp cause', async () => {
  await assert.rejects(
    () => convertToWebp(Buffer.from('not an image'), { quality: 85 }),
    (error) =>
      error instanceof ImageConversionError &&
      error.cause instanceof Error &&
      error.message === error.cause.message,
  );
});

for (const quality of [0, 101, 85.5, Number.NaN]) {
  test(`rejects invalid WebP quality ${quality}`, async () => {
    const inputBuffer = await createStillImage('png');

    await assert.rejects(
      () => convertToWebp(inputBuffer, { quality }),
      /WebP quality must be an integer from 1 to 100/,
    );
  });
}

for (const quality of [1, 100]) {
  test(`accepts WebP quality boundary ${quality}`, async () => {
    const inputBuffer = await createStillImage('png');
    const finalWebpBuffer = await convertToWebp(inputBuffer, { quality });

    assert.equal((await sharp(finalWebpBuffer).metadata()).format, 'webp');
  });
}
