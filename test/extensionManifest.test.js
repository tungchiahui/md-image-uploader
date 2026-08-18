const assert = require('node:assert/strict');
const test = require('node:test');

const manifest = require('../package.json');

test('contributes and activates the standalone S3 test upload command', () => {
  assert.equal(
    manifest.activationEvents.includes(
      'onCommand:mdImageUploader.testUpload',
    ),
    true,
  );
  assert.deepEqual(manifest.contributes.commands, [
    {
      command: 'mdImageUploader.testUpload',
      title: 'Test Upload',
      category: 'MD Image Uploader',
    },
  ]);
});
