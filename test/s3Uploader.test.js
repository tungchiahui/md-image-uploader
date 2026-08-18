const assert = require('node:assert/strict');
const test = require('node:test');

const {
  PutObjectCommand,
  S3Client,
} = require('@aws-sdk/client-s3');

const {
  S3UploadError,
  createS3Client,
  createS3ClientConfig,
  uploadWebp,
} = require('../dist/s3Uploader.js');

function createS3Config(overrides = {}) {
  return {
    endpoint: 'https://s3.example.com',
    region: 'ap-northeast-1',
    bucket: 'images',
    accessKeyId: 'ACCESS_KEY',
    secretAccessKey: 'SECRET_KEY',
    forcePathStyle: true,
    ...overrides,
  };
}

test('creates the complete AWS S3 client configuration', () => {
  assert.deepEqual(createS3ClientConfig(createS3Config()), {
    region: 'ap-northeast-1',
    endpoint: 'https://s3.example.com',
    forcePathStyle: true,
    credentials: {
      accessKeyId: 'ACCESS_KEY',
      secretAccessKey: 'SECRET_KEY',
    },
  });
});

test('omits an empty custom endpoint so AWS can resolve its default', () => {
  const clientConfig = createS3ClientConfig(
    createS3Config({ endpoint: '  ', forcePathStyle: false }),
  );

  assert.equal(clientConfig.endpoint, undefined);
  assert.equal(clientConfig.forcePathStyle, false);
});

test('creates an S3Client instance', () => {
  const client = createS3Client(createS3Config());

  try {
    assert.equal(client instanceof S3Client, true);
  } finally {
    client.destroy();
  }
});

test('uploads the exact final WebP Buffer with image/webp content type', async () => {
  const finalWebpBuffer = Buffer.from('final-webp-bytes');
  const sentCommands = [];
  const response = { ETag: 'test-etag', $metadata: {} };
  const client = {
    async send(command) {
      sentCommands.push(command);
      return response;
    },
  };

  const result = await uploadWebp(client, {
    bucket: 'images',
    objectKey: 'wiki/2026/08/18/image.webp',
    finalWebpBuffer,
  });

  assert.equal(result, response);
  assert.equal(sentCommands.length, 1);
  assert.equal(sentCommands[0] instanceof PutObjectCommand, true);
  assert.equal(sentCommands[0].input.Bucket, 'images');
  assert.equal(sentCommands[0].input.Key, 'wiki/2026/08/18/image.webp');
  assert.equal(sentCommands[0].input.Body, finalWebpBuffer);
  assert.equal(sentCommands[0].input.ContentType, 'image/webp');
});

test('wraps upload failures without swallowing the original cause', async () => {
  const originalError = new Error('network unavailable');
  const client = {
    async send() {
      throw originalError;
    },
  };

  await assert.rejects(
    () =>
      uploadWebp(client, {
        bucket: 'images',
        objectKey: 'test/image.webp',
        finalWebpBuffer: Buffer.from('webp'),
      }),
    (error) =>
      error instanceof S3UploadError &&
      error.bucket === 'images' &&
      error.objectKey === 'test/image.webp' &&
      error.message.endsWith(': network unavailable') &&
      error.cause === originalError,
  );
});
