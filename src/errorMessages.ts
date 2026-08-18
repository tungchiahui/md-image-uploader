import { ConfigValidationError } from './config';
import {
  ImageConversionError,
  UnsupportedImageFormatError,
} from './imageConverter';
import { S3UploadError } from './s3Uploader';

const authenticationErrorNames = new Set([
  'accessdenied',
  'accessdeniedexception',
  'credentialprovidererror',
  'expiredtoken',
  'expiredtokenexception',
  'invalidaccesskeyid',
  'invalidsignatureexception',
  'invalidtoken',
  'signaturedoesnotmatch',
  'unrecognizedclientexception',
]);

const networkErrorCodes = new Set([
  'eai_again',
  'econnrefused',
  'econnreset',
  'enetunreach',
  'enotfound',
  'etimedout',
]);

interface ErrorDetails {
  name?: unknown;
  code?: unknown;
  Code?: unknown;
  $metadata?: {
    httpStatusCode?: unknown;
  };
}

export function formatPasteError(error: unknown): string {
  if (error instanceof ConfigValidationError) {
    return `MD Image Uploader: ${error.message}`;
  }

  if (
    error instanceof UnsupportedImageFormatError ||
    error instanceof ImageConversionError
  ) {
    return `MD Image Uploader: Image conversion failed: ${error.message}`;
  }

  if (error instanceof S3UploadError) {
    return `MD Image Uploader: Upload failed: ${formatUploadCause(error.cause)}`;
  }

  return `MD Image Uploader: Paste failed: ${getErrorMessage(error)}`;
}

function formatUploadCause(cause: unknown): string {
  const reason = getErrorMessage(cause);

  if (isAuthenticationError(cause, reason)) {
    return `Authentication or authorization error: ${reason}`;
  }

  if (isNetworkError(cause, reason)) {
    return `Network error: ${reason}`;
  }

  return reason;
}

function isAuthenticationError(error: unknown, message: string): boolean {
  const details = getErrorDetails(error);
  const statusCode = details?.$metadata?.httpStatusCode;
  const names = [details?.name, details?.code, details?.Code]
    .filter((value): value is string => typeof value === 'string')
    .map((value) => value.toLowerCase());

  return (
    statusCode === 401 ||
    statusCode === 403 ||
    names.some((name) => authenticationErrorNames.has(name)) ||
    /access denied|credential|signature|unauthori[sz]ed/i.test(message)
  );
}

function isNetworkError(error: unknown, message: string): boolean {
  const details = getErrorDetails(error);
  const codes = [details?.name, details?.code, details?.Code]
    .filter((value): value is string => typeof value === 'string')
    .map((value) => value.toLowerCase());

  return (
    codes.some((code) => networkErrorCodes.has(code)) ||
    /dns|fetch failed|network|socket|timed?\s*out|connection/i.test(message)
  );
}

function getErrorDetails(error: unknown): ErrorDetails | undefined {
  return typeof error === 'object' && error !== null
    ? (error as ErrorDetails)
    : undefined;
}

function getErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
