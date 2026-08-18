export function buildCdnUrl(cdnUrl: string, objectKey: string): string {
  const baseUrl = cdnUrl.trim().replace(/\/+$/, '');
  const encodedObjectKey = objectKey
    .split('/')
    .map((segment) => encodeURIComponent(segment))
    .join('/');

  return `${baseUrl}/${encodedObjectKey}`;
}
