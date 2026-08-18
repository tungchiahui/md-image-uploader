export interface CalendarDate {
  year: number;
  month: number;
  day: number;
}

export type PageDateSource = 'directory' | 'filename';

export interface PageDateMatch {
  date: CalendarDate;
  source: PageDateSource;
}

export function findPageDate(
  workspaceRelativePath: string,
): PageDateMatch | undefined {
  const pathSegments = splitPath(workspaceRelativePath);
  const basename = pathSegments.pop();

  if (basename === undefined) {
    return undefined;
  }

  for (let index = pathSegments.length - 1; index >= 0; index -= 1) {
    const directoryDate = findFirstValidDate(pathSegments[index]);

    if (directoryDate !== undefined) {
      return {
        date: directoryDate,
        source: 'directory',
      };
    }
  }

  const filenameDate = findFirstValidDate(basename);

  if (filenameDate === undefined) {
    return undefined;
  }

  return {
    date: filenameDate,
    source: 'filename',
  };
}

export function getLocalCalendarDate(now: Date): CalendarDate {
  const date = {
    year: now.getFullYear(),
    month: now.getMonth() + 1,
    day: now.getDate(),
  };

  if (!isValidCalendarDate(date)) {
    throw new RangeError('Cannot route an invalid local date');
  }

  return date;
}

export function isValidCalendarDate(date: CalendarDate): boolean {
  const { year, month, day } = date;

  if (
    !Number.isInteger(year) ||
    !Number.isInteger(month) ||
    !Number.isInteger(day) ||
    year < 1 ||
    year > 9999 ||
    month < 1 ||
    month > 12 ||
    day < 1
  ) {
    return false;
  }

  return day <= daysInMonth(year, month);
}

function splitPath(workspaceRelativePath: string): string[] {
  return workspaceRelativePath
    .replaceAll('\\', '/')
    .split('/')
    .filter((segment) => segment.length > 0 && segment !== '.');
}

function findFirstValidDate(text: string): CalendarDate | undefined {
  const datePattern = /(?:^|[^\d])(\d{4})-(\d{2})-(\d{2})(?!\d)/g;

  for (const match of text.matchAll(datePattern)) {
    const date = {
      year: Number(match[1]),
      month: Number(match[2]),
      day: Number(match[3]),
    };

    if (isValidCalendarDate(date)) {
      return date;
    }
  }

  return undefined;
}

function daysInMonth(year: number, month: number): number {
  if (month === 2) {
    return isLeapYear(year) ? 29 : 28;
  }

  return [4, 6, 9, 11].includes(month) ? 30 : 31;
}

function isLeapYear(year: number): boolean {
  return year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0);
}
