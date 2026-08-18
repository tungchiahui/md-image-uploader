const assert = require('node:assert/strict');
const test = require('node:test');

const {
  findPageDate,
  getLocalCalendarDate,
  isValidCalendarDate,
} = require('../dist/dateRouter.js');

function expectedMatch(year, month, day, source) {
  return {
    date: { year, month, day },
    source,
  };
}

test('Case 1: extracts a directory date', () => {
  assert.deepEqual(
    findPageDate(
      'wiki/2023-10-05-Cplusplus教学/0200-C++基础初识.md',
    ),
    expectedMatch(2023, 10, 5, 'directory'),
  );
});

test('Case 2: falls back to the Markdown filename date', () => {
  assert.deepEqual(
    findPageDate('docs/drivers/2026-01-14-W311MI_AX300驱动.md'),
    expectedMatch(2026, 1, 14, 'filename'),
  );
});

test('Case 3: directory date takes priority over filename date', () => {
  assert.deepEqual(
    findPageDate(
      'docs/2025-05-20-project/2026-01-14-W311MI_AX300驱动.md',
    ),
    expectedMatch(2025, 5, 20, 'directory'),
  );
});

test('Case 4: nearest parent directory date takes priority', () => {
  assert.deepEqual(
    findPageDate(
      'archive/2024-01-01/foo/2026-03-15-project/article.md',
    ),
    expectedMatch(2026, 3, 15, 'directory'),
  );
});

test('Case 5: returns undefined for an undated document', () => {
  assert.equal(
    findPageDate('docs/drivers/W311MI_AX300驱动.md'),
    undefined,
  );
});

test('Case 6: invalid directory date allows filename fallback', () => {
  assert.deepEqual(
    findPageDate('docs/2023-02-29-project/2026-01-14-test.md'),
    expectedMatch(2026, 1, 14, 'filename'),
  );
});

test('Case 7: accepts a valid leap-day directory date', () => {
  assert.deepEqual(
    findPageDate('docs/2024-02-29-project/test.md'),
    expectedMatch(2024, 2, 29, 'directory'),
  );
});

test('rejects invalid month and invalid day candidates', () => {
  assert.equal(findPageDate('docs/2026-13-01/project.md'), undefined);
  assert.equal(findPageDate('docs/2026-04-31-project.md'), undefined);
});

test('continues from an invalid nearby directory to a valid parent directory', () => {
  assert.deepEqual(
    findPageDate('archive/2024-01-01/2026-04-31-project/article.md'),
    expectedMatch(2024, 1, 1, 'directory'),
  );
});

test('supports Windows path separators without changing date priority', () => {
  assert.deepEqual(
    findPageDate(
      'docs\\2025-05-20-project\\2026-01-14-W311MI_AX300驱动.md',
    ),
    expectedMatch(2025, 5, 20, 'directory'),
  );
});

test('does not match a date embedded in a longer digit sequence', () => {
  assert.equal(findPageDate('docs/12026-01-14-project/article.md'), undefined);
  assert.equal(findPageDate('docs/article-2026-01-140.md'), undefined);
});

test('validates Gregorian leap-year rules', () => {
  assert.equal(
    isValidCalendarDate({ year: 2000, month: 2, day: 29 }),
    true,
  );
  assert.equal(
    isValidCalendarDate({ year: 1900, month: 2, day: 29 }),
    false,
  );
});

test('reads fallback dates from local date accessors', () => {
  const localNow = {
    getFullYear: () => 2026,
    getMonth: () => 7,
    getDate: () => 18,
    getUTCFullYear: () => 1999,
    getUTCMonth: () => 0,
    getUTCDate: () => 1,
  };

  assert.deepEqual(getLocalCalendarDate(localNow), {
    year: 2026,
    month: 8,
    day: 18,
  });
});
