import {
  PutObjectCommand,
  S3Client,
  type PutObjectCommandOutput,
  type S3ClientConfig,
} from '@aws-sdk/client-s3';

import type { S3Config } from './config';

export interface UploadWebpOptions {
  bucket: string;
  objectKey: string;
  finalWebpBuffer: Buffer;
}

export type PutObjectClient = Pick<S3Client, 'send'>;

export class S3UploadError extends Error {
  public readonly bucket: string;
  public readonly objectKey: string;

  public constructor(
    bucket: string,
    objectKey: string,
    cause: unknown,
  ) {
    super(
      `Failed to upload "${objectKey}" to bucket "${bucket}": ${getErrorMessage(cause)}`,
      { cause },
    );
    this.name = 'S3UploadError';
    this.bucket = bucket;
    this.objectKey = objectKey;
  }
}

function getErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

export function createS3ClientConfig(config: S3Config): S3ClientConfig {
  const endpoint = config.endpoint.trim();

  return {
    region: config.region,
    endpoint: endpoint.length === 0 ? undefined : endpoint,
    forcePathStyle: config.forcePathStyle,
    credentials: {
      accessKeyId: config.accessKeyId,
      secretAccessKey: config.secretAccessKey,
    },
  };
}

export function createS3Client(config: S3Config): S3Client {
  return new S3Client(createS3ClientConfig(config));
}

export async function uploadWebp(
  client: PutObjectClient,
  options: UploadWebpOptions,
): Promise<PutObjectCommandOutput> {
  const command = new PutObjectCommand({
    Bucket: options.bucket,
    Key: options.objectKey,
    Body: options.finalWebpBuffer,
    ContentType: 'image/webp',
  });

  try {
    return await client.send(command);
  } catch (error) {
    throw new S3UploadError(options.bucket, options.objectKey, error);
  }
}
