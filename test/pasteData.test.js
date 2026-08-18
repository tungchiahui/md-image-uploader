const assert = require('node:assert/strict');
const test = require('node:test');

const {
  IMAGE_PASTE_KIND_VALUE,
  IMAGE_PASTE_MIME_TYPES,
  extractFirstSupportedImage,
} = require('../dist/pasteData.js');

function createItem({ bytes, fileName, value, onAsString }) {
  const file =
    bytes === undefined || fileName === undefined
      ? undefined
      : {
          name: fileName,
          async data() {
            return bytes;
          },
        };

  return {
    value,
    asFile() {
      return file;
    },
    async asString() {
      onAsString?.();
      return String(value ?? '');
    },
  };
}

test('declares the required paste kind and MIME metadata', () => {
  assert.equal(IMAGE_PASTE_KIND_VALUE, 'markdown.image.mdImageUploader');
  assert.deepEqual(IMAGE_PASTE_MIME_TYPES, ['image/*', 'files']);
});

test('copies direct image MIME bytes while the DataTransfer is valid', async () => {
  const sourceBytes = Uint8Array.from([1, 2, 3, 4]);
  const item = createItem({ bytes: sourceBytes, fileName: 'clipboard.png' });

  const image = await extractFirstSupportedImage([
    ['image/png', item],
  ]);
  sourceBytes[0] = 99;

  assert.deepEqual(image, {
    inputBuffer: Buffer.from([1, 2, 3, 4]),
    mimeType: 'image/png',
    fileName: 'clipboard.png',
  });
});

test('reads screenshot-style image bytes from the item value', async () => {
  const image = await extractFirstSupportedImage([
    [
      'IMAGE/PNG; charset=binary',
      createItem({ value: Uint8Array.from([5, 6, 7]) }),
    ],
  ]);

  assert.deepEqual(image, {
    inputBuffer: Buffer.from([5, 6, 7]),
    mimeType: 'image/png',
    fileName: undefined,
  });
});

for (const [fileName, expectedMimeType] of [
  ['image.png', 'image/png'],
  ['image.JPG', 'image/jpeg'],
  ['image.jpeg', 'image/jpeg'],
  ['image.gif', 'image/gif'],
  ['image.webp', 'image/webp'],
  ['image.avif', 'image/avif'],
  ['image.tif', 'image/tiff'],
  ['image.TIFF', 'image/tiff'],
]) {
  test(`recognizes external file ${fileName}`, async () => {
    const image = await extractFirstSupportedImage([
      [
        'application/octet-stream',
        createItem({
          bytes: Uint8Array.from([8, 9]),
          fileName,
        }),
      ],
    ]);

    assert.equal(image.mimeType, expectedMimeType);
    assert.equal(image.fileName, fileName);
    assert.deepEqual(image.inputBuffer, Buffer.from([8, 9]));
  });
}

test('only returns the first valid image in a multi-item paste', async () => {
  const image = await extractFirstSupportedImage([
    [
      'application/octet-stream',
      createItem({ bytes: Uint8Array.from([1]), fileName: 'notes.txt' }),
    ],
    [
      'image/jpeg',
      createItem({ bytes: Uint8Array.from([2]), fileName: 'first.jpg' }),
    ],
    [
      'image/png',
      createItem({ bytes: Uint8Array.from([3]), fileName: 'second.png' }),
    ],
  ]);

  assert.equal(image.fileName, 'first.jpg');
  assert.deepEqual(image.inputBuffer, Buffer.from([2]));
});

test('returns undefined for text without reading its string value', async () => {
  let stringReads = 0;
  const image = await extractFirstSupportedImage([
    [
      'text/plain',
      createItem({ value: 'hello', onAsString: () => { stringReads += 1; } }),
    ],
  ]);

  assert.equal(image, undefined);
  assert.equal(stringReads, 0);
});

test('returns undefined for code, URL, and unsupported image formats', async () => {
  for (const [mimeType, value] of [
    ['text/plain', 'int main() {}'],
    ['text/uri-list', 'https://example.com'],
    ['image/svg+xml', '<svg></svg>'],
  ]) {
    assert.equal(
      await extractFirstSupportedImage([
        [mimeType, createItem({ value })],
      ]),
      undefined,
    );
  }
});

test('returns undefined for unsupported external files', async () => {
  const image = await extractFirstSupportedImage([
    [
      'application/octet-stream',
      createItem({ bytes: Uint8Array.from([1]), fileName: 'diagram.svg' }),
    ],
  ]);

  assert.equal(image, undefined);
});

test('stops without reading data after cancellation', async () => {
  let dataReads = 0;
  const item = {
    value: undefined,
    asFile() {
      return {
        name: 'image.png',
        async data() {
          dataReads += 1;
          return Uint8Array.from([1]);
        },
      };
    },
  };

  const image = await extractFirstSupportedImage(
    [['image/png', item]],
    { isCancellationRequested: true },
  );

  assert.equal(image, undefined);
  assert.equal(dataReads, 0);
});
