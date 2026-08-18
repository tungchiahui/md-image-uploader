import { isSupportedImageMimeType } from './imageConverter';

export const IMAGE_PASTE_KIND_VALUE = 'markdown.image.mdImageUploader';
export const IMAGE_PASTE_MIME_TYPES = ['image/*', 'files'] as const;

export interface ImagePasteInput {
  inputBuffer: Buffer;
  mimeType: string;
  fileName: string | undefined;
}

export interface DataTransferFileLike {
  readonly name: string;
  data(): PromiseLike<Uint8Array>;
}

export interface DataTransferItemLike {
  readonly value: unknown;
  asFile(): DataTransferFileLike | undefined;
}

export type DataTransferLike = Iterable<
  readonly [mimeType: string, item: DataTransferItemLike]
>;

export interface CancellationLike {
  readonly isCancellationRequested: boolean;
}

const extensionMimeTypes = new Map<string, string>([
  ['.png', 'image/png'],
  ['.jpg', 'image/jpeg'],
  ['.jpeg', 'image/jpeg'],
  ['.gif', 'image/gif'],
  ['.webp', 'image/webp'],
  ['.avif', 'image/avif'],
  ['.tif', 'image/tiff'],
  ['.tiff', 'image/tiff'],
]);

export async function extractFirstSupportedImage(
  dataTransfer: DataTransferLike,
  cancellation?: CancellationLike,
): Promise<ImagePasteInput | undefined> {
  const entries = [...dataTransfer];

  for (const [mimeType, item] of entries) {
    if (cancellation?.isCancellationRequested === true) {
      return undefined;
    }

    if (!isSupportedImageMimeType(mimeType)) {
      continue;
    }

    const inputBuffer = await readItemBytes(item);

    if (inputBuffer !== undefined) {
      return {
        inputBuffer,
        mimeType: normalizeMimeType(mimeType),
        fileName: item.asFile()?.name,
      };
    }
  }

  for (const [, item] of entries) {
    if (cancellation?.isCancellationRequested === true) {
      return undefined;
    }

    const file = item.asFile();

    if (file === undefined) {
      continue;
    }

    const mimeType = getMimeTypeFromFileName(file.name);

    if (mimeType === undefined) {
      continue;
    }

    return {
      inputBuffer: Buffer.from(await file.data()),
      mimeType,
      fileName: file.name,
    };
  }

  return undefined;
}

function normalizeMimeType(mimeType: string): string {
  return mimeType.split(';', 1)[0].trim().toLowerCase();
}

function getMimeTypeFromFileName(fileName: string): string | undefined {
  const extensionMatch = /\.[^.]+$/.exec(fileName.toLowerCase());
  return extensionMatch === null
    ? undefined
    : extensionMimeTypes.get(extensionMatch[0]);
}

async function readItemBytes(
  item: DataTransferItemLike,
): Promise<Buffer | undefined> {
  const file = item.asFile();

  if (file !== undefined) {
    return Buffer.from(await file.data());
  }

  if (Buffer.isBuffer(item.value) || item.value instanceof Uint8Array) {
    return Buffer.from(item.value);
  }

  if (item.value instanceof ArrayBuffer) {
    return Buffer.from(new Uint8Array(item.value));
  }

  return undefined;
}
