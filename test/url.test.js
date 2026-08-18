const assert = require('node:assert/strict');
const test = require('node:test');

const { buildCdnUrl } = require('../dist/url.js');

test('buildCdnUrl removes trailing slashes from the CDN base URL', () => {
  assert.equal(
    buildCdnUrl(
      'https://cdn.example.com///',
      'wiki/2023/10/05/image.webp',
    ),
    'https://cdn.example.com/wiki/2023/10/05/image.webp',
  );
});

test('buildCdnUrl encodes each object-key segment while preserving slashes', () => {
  assert.equal(
    buildCdnUrl(
      'https://cdn.example.com',
      'wiki images/中文/what?#.webp',
    ),
    'https://cdn.example.com/wiki%20images/%E4%B8%AD%E6%96%87/what%3F%23.webp',
  );
});
