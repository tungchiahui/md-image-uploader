const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const readme = readFileSync(path.join(__dirname, '..', 'README.md'), 'utf8');

test('README documents installation, configuration, paste, and troubleshooting', () => {
  for (const heading of [
    '## Installation',
    '## Configuration',
    '## Paste an image',
    '## Troubleshooting',
  ]) {
    assert.equal(readme.includes(heading), true, `missing ${heading}`);
  }
});

test('README documents multi-repository resource-scoped configuration', () => {
  assert.match(readme, /## Multiple repositories and workspaces/);
  assert.match(readme, /Workspace Folder Settings/);
  assert.match(readme, /active Markdown document URI/);
});

test('README documents paste preference and all required error categories', () => {
  assert.match(readme, /markdown\.image\.mdImageUploader/);

  for (const message of [
    'Missing setting',
    'Image conversion failed',
    'Upload failed: Network error',
    'Upload failed: Authentication or authorization error',
  ]) {
    assert.equal(readme.includes(message), true, `missing ${message}`);
  }
});
