const assert = require('node:assert/strict');
const test = require('node:test');

const { ConfigValidationError } = require('../dist/config.js');
const { formatPasteError } = require('../dist/errorMessages.js');
const {
  ImageConversionError,
  UnsupportedImageFormatError,
} = require('../dist/imageConverter.js');
const { S3UploadError } = require('../dist/s3Uploader.js');

test('formats missing configuration with the exact setting name', () => {
  assert.equal(
    formatPasteError(new ConfigValidationError('s3.bucket')),
    'MD Image Uploader: Missing setting "s3.bucket"',
  );
});

test('formats unsupported image formats as conversion failures', () => {
  assert.equal(
    formatPasteError(new UnsupportedImageFormatError('image/svg+xml')),
    'MD Image Uploader: Image conversion failed: Unsupported image format: image/svg+xml',
  );
});

test('formats Sharp decoding and WebP conversion failures', () => {
  assert.equal(
    formatPasteError(
      new ImageConversionError(new Error('Input buffer contains invalid data')),
    ),
    'MD Image Uploader: Image conversion failed: Input buffer contains invalid data',
  );
});

test('identifies S3 network failures while keeping the upload prefix', () => {
  const cause = Object.assign(new Error('getaddrinfo ENOTFOUND s3.example.com'), {
    code: 'ENOTFOUND',
  });

  assert.equal(
    formatPasteError(new S3UploadError('images', 'key.webp', cause)),
    'MD Image Uploader: Upload failed: Network error: getaddrinfo ENOTFOUND s3.example.com',
  );
});

test('identifies S3 authentication and authorization failures', () => {
  const cause = Object.assign(new Error('Access Denied'), {
    name: 'AccessDenied',
    $metadata: { httpStatusCode: 403 },
  });

  assert.equal(
    formatPasteError(new S3UploadError('images', 'key.webp', cause)),
    'MD Image Uploader: Upload failed: Authentication or authorization error: Access Denied',
  );
});

test('keeps the original reason for other S3 upload failures', () => {
  assert.equal(
    formatPasteError(
      new S3UploadError(
        'images',
        'key.webp',
        new Error('Service unavailable'),
      ),
    ),
    'MD Image Uploader: Upload failed: Service unavailable',
  );
});

test('uses a generic paste prefix for unexpected failures', () => {
  assert.equal(
    formatPasteError(new Error('unexpected failure')),
    'MD Image Uploader: Paste failed: unexpected failure',
  );
});
