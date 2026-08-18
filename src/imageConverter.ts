import { spawn } from 'node:child_process';
import path from 'node:path';

export const SUPPORTED_IMAGE_MIME_TYPES = [
  'image/png',
  'image/jpeg',
  'image/gif',
  'image/webp',
  'image/avif',
  'image/tiff',
] as const;

export type SupportedImageMimeType =
  (typeof SUPPORTED_IMAGE_MIME_TYPES)[number];

export interface ConvertToWebpOptions {
  quality: number;
}

export class UnsupportedImageFormatError extends Error {
  public readonly mediaType: string | undefined;

  public constructor(mediaType: string | undefined) {
    super(
      mediaType === undefined
        ? 'Unsupported image format'
        : `Unsupported image format: ${mediaType}`,
    );
    this.name = 'UnsupportedImageFormatError';
    this.mediaType = mediaType;
  }
}

export class ImageConversionError extends Error {
  public constructor(cause: unknown) {
    super(getErrorMessage(cause), { cause });
    this.name = 'ImageConversionError';
  }
}

interface WorkerErrorPayload {
  type?: unknown;
  message?: unknown;
  mediaType?: unknown;
}

const CONVERSION_TIMEOUT_MS = 30_000;
const supportedMediaTypes = new Set<string>(SUPPORTED_IMAGE_MIME_TYPES);

export function isSupportedImageMimeType(mimeType: string): boolean {
  const normalizedMimeType = mimeType.split(';', 1)[0].trim().toLowerCase();
  return supportedMediaTypes.has(normalizedMimeType);
}

export async function convertToWebp(
  inputBuffer: Buffer,
  options: ConvertToWebpOptions,
): Promise<Buffer> {
  validateQuality(options.quality);

  try {
    return await runConversionWorker(inputBuffer, options.quality);
  } catch (error) {
    if (error instanceof UnsupportedImageFormatError) {
      throw error;
    }

    throw new ImageConversionError(error);
  }
}

function runConversionWorker(
  inputBuffer: Buffer,
  quality: number,
): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const workerPath = path.join(__dirname, 'imageConverterWorker.js');
    const child = spawn(process.execPath, [workerPath, String(quality)], {
      env: {
        ...process.env,
        ELECTRON_RUN_AS_NODE: '1',
      },
      stdio: ['pipe', 'pipe', 'pipe'],
      windowsHide: true,
    });
    const outputChunks: Buffer[] = [];
    const errorChunks: Buffer[] = [];
    let timedOut = false;
    let settled = false;
    let stdinError: Error | undefined;

    const resolveOnce = (outputBuffer: Buffer): void => {
      if (!settled) {
        settled = true;
        resolve(outputBuffer);
      }
    };
    const rejectOnce = (error: Error): void => {
      if (!settled) {
        settled = true;
        reject(error);
      }
    };

    const timeout = setTimeout(() => {
      timedOut = true;
      child.kill('SIGKILL');
    }, CONVERSION_TIMEOUT_MS);

    child.stdout.on('data', (chunk: Buffer) => outputChunks.push(chunk));
    child.stderr.on('data', (chunk: Buffer) => errorChunks.push(chunk));
    child.stdin.on('error', (error) => {
      stdinError = error;
    });

    child.once('error', (error) => {
      clearTimeout(timeout);
      rejectOnce(error);
    });

    child.once('close', (exitCode, signal) => {
      clearTimeout(timeout);

      if (timedOut) {
        rejectOnce(
          new Error(
            `Image conversion exceeded ${CONVERSION_TIMEOUT_MS / 1000} seconds`,
          ),
        );
        return;
      }

      if (exitCode === 0) {
        resolveOnce(Buffer.concat(outputChunks));
        return;
      }

      const workerError = parseWorkerError(Buffer.concat(errorChunks));
      if (workerError?.type === 'unsupported') {
        rejectOnce(
          new UnsupportedImageFormatError(
            typeof workerError.mediaType === 'string'
              ? workerError.mediaType
              : undefined,
          ),
        );
        return;
      }

      if (typeof workerError?.message === 'string') {
        rejectOnce(new Error(workerError.message));
        return;
      }

      if (stdinError !== undefined) {
        rejectOnce(stdinError);
        return;
      }

      const termination =
        signal === null
          ? `exit code ${String(exitCode)}`
          : `signal ${signal}`;
      rejectOnce(
        new Error(`Image conversion worker stopped with ${termination}`),
      );
    });

    child.stdin.end(inputBuffer);
  });
}

function parseWorkerError(buffer: Buffer): WorkerErrorPayload | undefined {
  try {
    const value: unknown = JSON.parse(buffer.toString('utf8'));
    return typeof value === 'object' && value !== null
      ? (value as WorkerErrorPayload)
      : undefined;
  } catch {
    return undefined;
  }
}

function validateQuality(quality: number): void {
  if (!Number.isInteger(quality) || quality < 1 || quality > 100) {
    throw new RangeError('WebP quality must be an integer from 1 to 100');
  }
}

function getErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
