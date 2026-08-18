import {
  type CalendarDate,
  type PageDateMatch,
  findPageDate,
  getLocalCalendarDate,
  isValidCalendarDate,
} from './dateRouter';

export type UploadRoute = 'dated' | 'undated';

export interface BuildObjectKeyOptions {
  uploadPath: string;
  date: CalendarDate;
  timestamp: number;
  hash8: string;
}

export interface RouteObjectKeyOptions {
  workspaceRelativePath: string;
  datedUploadPath: string;
  undatedUploadPath: string;
  now: Date;
  hash8: string;
}

export interface RoutedObjectKey {
  objectKey: string;
  route: UploadRoute;
  date: CalendarDate;
  pageDate: PageDateMatch | undefined;
  timestamp: number;
}

export function createRoutedObjectKey(
  options: RouteObjectKeyOptions,
): RoutedObjectKey {
  const pageDate = findPageDate(options.workspaceRelativePath);
  const route = pageDate === undefined ? 'undated' : 'dated';
  const date = pageDate?.date ?? getLocalCalendarDate(options.now);
  const uploadPath =
    route === 'dated' ? options.datedUploadPath : options.undatedUploadPath;
  const timestamp = options.now.getTime();

  return {
    objectKey: buildObjectKey({
      uploadPath,
      date,
      timestamp,
      hash8: options.hash8,
    }),
    route,
    date,
    pageDate,
    timestamp,
  };
}

export function buildObjectKey(options: BuildObjectKeyOptions): string {
  if (!isValidCalendarDate(options.date)) {
    throw new RangeError('Cannot build an object key with an invalid date');
  }

  if (!Number.isSafeInteger(options.timestamp) || options.timestamp < 0) {
    throw new RangeError('Timestamp must be a non-negative safe integer');
  }

  return joinObjectKey(
    options.uploadPath,
    String(options.date.year).padStart(4, '0'),
    String(options.date.month).padStart(2, '0'),
    String(options.date.day).padStart(2, '0'),
    `${options.timestamp}-${options.hash8}.webp`,
  );
}

export function joinObjectKey(...segments: string[]): string {
  return segments
    .flatMap((segment) => segment.replaceAll('\\', '/').split('/'))
    .filter((segment) => segment.length > 0)
    .join('/');
}
