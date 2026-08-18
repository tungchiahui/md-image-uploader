const assert = require('node:assert/strict');
const test = require('node:test');

const {
  buildObjectKey,
  createRoutedObjectKey,
  joinObjectKey,
} = require('../dist/objectKey.js');

const timestamp = 1787039123456;
const hash8 = 'a3f91c2e';

function createLocalNow() {
  return {
    getTime: () => timestamp,
    getFullYear: () => 2026,
    getMonth: () => 7,
    getDate: () => 18,
  };
}

test('buildObjectKey produces the exact dated key from the specification', () => {
  assert.equal(
    buildObjectKey({
      uploadPath: 'wiki',
      date: { year: 2023, month: 10, day: 5 },
      timestamp,
      hash8,
    }),
    'wiki/2023/10/05/1787039123456-a3f91c2e.webp',
  );
});

test('joinObjectKey normalizes leading, trailing, duplicate, and backslash separators', () => {
  assert.equal(
    joinObjectKey('/wiki//images/', '\\2023\\10', '05/', 'image.webp'),
    'wiki/images/2023/10/05/image.webp',
  );
});

test('buildObjectKey normalizes the configured upload path', () => {
  assert.equal(
    buildObjectKey({
      uploadPath: '/wiki//images/',
      date: { year: 2023, month: 10, day: 5 },
      timestamp,
      hash8,
    }),
    'wiki/images/2023/10/05/1787039123456-a3f91c2e.webp',
  );
});

test('routes a directory date through datedUploadPath', () => {
  const result = createRoutedObjectKey({
    workspaceRelativePath:
      'docs/2025-05-20-project/2026-01-14-W311MI_AX300驱动.md',
    datedUploadPath: 'wiki',
    undatedUploadPath: 'misc',
    now: createLocalNow(),
    hash8,
  });

  assert.deepEqual(result, {
    objectKey: 'wiki/2025/05/20/1787039123456-a3f91c2e.webp',
    route: 'dated',
    date: { year: 2025, month: 5, day: 20 },
    pageDate: {
      date: { year: 2025, month: 5, day: 20 },
      source: 'directory',
    },
    timestamp,
  });
});

test('routes a filename date through datedUploadPath', () => {
  const result = createRoutedObjectKey({
    workspaceRelativePath: 'docs/drivers/2026-01-14-W311MI_AX300驱动.md',
    datedUploadPath: 'wiki',
    undatedUploadPath: 'misc',
    now: createLocalNow(),
    hash8,
  });

  assert.equal(
    result.objectKey,
    'wiki/2026/01/14/1787039123456-a3f91c2e.webp',
  );
  assert.equal(result.route, 'dated');
  assert.equal(result.pageDate.source, 'filename');
});

test('routes an undated document through undatedUploadPath and local date', () => {
  const result = createRoutedObjectKey({
    workspaceRelativePath: 'docs/drivers/W311MI_AX300驱动.md',
    datedUploadPath: 'wiki',
    undatedUploadPath: 'misc',
    now: createLocalNow(),
    hash8,
  });

  assert.deepEqual(result, {
    objectKey: 'misc/2026/08/18/1787039123456-a3f91c2e.webp',
    route: 'undated',
    date: { year: 2026, month: 8, day: 18 },
    pageDate: undefined,
    timestamp,
  });
});

test('buildObjectKey rejects invalid dates and timestamps', () => {
  assert.throws(
    () =>
      buildObjectKey({
        uploadPath: 'wiki',
        date: { year: 2026, month: 4, day: 31 },
        timestamp,
        hash8,
      }),
    /invalid date/,
  );

  assert.throws(
    () =>
      buildObjectKey({
        uploadPath: 'wiki',
        date: { year: 2026, month: 4, day: 30 },
        timestamp: Number.NaN,
        hash8,
      }),
    /Timestamp/,
  );
});
