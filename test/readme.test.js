const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const readme = readFileSync(path.join(__dirname, '..', 'README.md'), 'utf8');
const readmeZh = readFileSync(
  path.join(__dirname, '..', 'README-zh_CN.md'),
  'utf8',
);

test('English and Chinese READMEs link to each other', () => {
  assert.match(readme, /^\[中文\]\(README-zh_CN\.md\) \| English/);
  assert.match(readmeZh, /^中文 \| \[English\]\(README\.md\)/);
});

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

test('Chinese README covers installation, configuration, routing, and troubleshooting', () => {
  for (const heading of [
    '## 安装',
    '## 配置',
    '## 粘贴图片',
    '## 日期路由与 Object Key',
    '## 多仓库与多根工作区',
    '## 故障排查',
  ]) {
    assert.equal(readmeZh.includes(heading), true, `missing ${heading}`);
  }
});
