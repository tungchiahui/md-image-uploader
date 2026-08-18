import sharp from 'sharp';

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
    const inputMetadata = await sharp(inputBuffer, {
      animated: true,
    }).metadata();

    if (
      inputMetadata.mediaType === undefined ||
      !isSupportedImageMimeType(inputMetadata.mediaType)
    ) {
      throw new UnsupportedImageFormatError(inputMetadata.mediaType);
    }

    return await sharp(inputBuffer, { animated: true })
      .rotate()
      .webp({ quality: options.quality })
      .toBuffer();
  } catch (error) {
    if (error instanceof UnsupportedImageFormatError) {
      throw error;
    }

    throw new ImageConversionError(error);
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
