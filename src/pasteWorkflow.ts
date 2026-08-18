import type { MdImageUploaderConfig } from './config';
import { convertToWebp } from './imageConverter';
import { hashFinalWebp } from './hash';
import {
  createRoutedObjectKey,
  type RoutedObjectKey,
} from './objectKey';
import { createS3Client, uploadWebp } from './s3Uploader';
import { buildCdnUrl } from './url';
import type { PasteProgressReporter } from './progress';

export interface ProcessImagePasteOptions {
  inputBuffer: Buffer;
  workspaceRelativePath: string;
  config: MdImageUploaderConfig;
  now: Date;
  onProgress?: PasteProgressReporter;
}

export interface ImagePasteWorkflowResult extends RoutedObjectKey {
  fullHash: string;
  hash8: string;
  cdnUrl: string;
  markdown: string;
}

export interface ImagePasteWorkflowDependencies {
  convertToWebp: typeof convertToWebp;
  hashFinalWebp: typeof hashFinalWebp;
  createS3Client: typeof createS3Client;
  uploadWebp: typeof uploadWebp;
}

const defaultDependencies: ImagePasteWorkflowDependencies = {
  convertToWebp,
  hashFinalWebp,
  createS3Client,
  uploadWebp,
};

export async function processImagePaste(
  options: ProcessImagePasteOptions,
  dependencies: ImagePasteWorkflowDependencies = defaultDependencies,
): Promise<ImagePasteWorkflowResult> {
  options.onProgress?.({ stage: 'converting' });
  const finalWebpBuffer = await dependencies.convertToWebp(
    options.inputBuffer,
    { quality: options.config.webp.quality },
  );
  const hash = dependencies.hashFinalWebp(finalWebpBuffer);
  options.onProgress?.({ stage: 'routing' });
  const routing = createRoutedObjectKey({
    workspaceRelativePath: options.workspaceRelativePath,
    datedUploadPath: options.config.datedUploadPath,
    undatedUploadPath: options.config.undatedUploadPath,
    now: options.now,
    hash8: hash.hash8,
  });
  const client = dependencies.createS3Client(options.config.s3);

  try {
    options.onProgress?.({
      stage: 'uploading',
      objectKey: routing.objectKey,
    });
    await dependencies.uploadWebp(client, {
      bucket: options.config.s3.bucket,
      objectKey: routing.objectKey,
      finalWebpBuffer,
    });
  } finally {
    client.destroy();
  }

  const publicUrl = buildCdnUrl(options.config.cdnUrl, routing.objectKey);

  return {
    ...routing,
    ...hash,
    cdnUrl: publicUrl,
    markdown: `![](${publicUrl})`,
  };
}
