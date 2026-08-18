const assert = require('node:assert/strict');
const test = require('node:test');

const {
  createTranslator,
  translateProgressStage,
} = require('../dist/localization.js');

test('localizes inline paste progress from the VS Code display language', () => {
  assert.equal(
    translateProgressStage(createTranslator('en'), 'uploading'),
    'MD Image Uploader: Uploading to object storage…',
  );
  assert.equal(
    translateProgressStage(createTranslator('zh-cn'), 'uploading'),
    'MD Image Uploader：正在上传到对象存储…',
  );
  assert.equal(
    translateProgressStage(createTranslator('zh-tw'), 'uploading'),
    'MD Image Uploader：正在上傳至物件儲存空間…',
  );
});

test('supports Chinese locale variants and falls back to English', () => {
  assert.match(createTranslator('zh-Hans')('progressComplete'), /上传完成/);
  assert.match(createTranslator('zh-Hant')('progressComplete'), /上傳完成/);
  assert.equal(
    createTranslator('fr')('progressComplete'),
    'MD Image Uploader: Upload complete',
  );
});

test('formats localized output log fields', () => {
  assert.equal(
    createTranslator('zh-cn')(
      'logPasteSucceeded',
      125,
      'wiki/2026/08/18/image.webp',
    ),
    '粘贴成功，耗时 125 毫秒：对象路径=wiki/2026/08/18/image.webp。',
  );
});
