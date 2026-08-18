import * as vscode from 'vscode';

import { readConfig, validateS3Config } from './config';
import { createTranslator, type Translate } from './localization';
import { noopLogger, type ExtensionLogger } from './logging';
import { joinObjectKey } from './objectKey';
import { createS3Client, uploadWebp } from './s3Uploader';

export const TEST_UPLOAD_COMMAND = 'mdImageUploader.testUpload';

const testWebpBase64 =
  'UklGRh4AAABXRUJQVlA4TBEAAAAvAUAAAAfQvrZUuv+BiOh/AAA=';

export function registerTestUploadCommand(
  context: vscode.ExtensionContext,
  logger: ExtensionLogger = noopLogger,
  translate: Translate = createTranslator('en'),
): void {
  context.subscriptions.push(
    vscode.commands.registerCommand(TEST_UPLOAD_COMMAND, () =>
      runTestUpload(logger, translate),
    ),
  );
}

async function runTestUpload(
  logger: ExtensionLogger,
  translate: Translate,
): Promise<void> {
  const editor = vscode.window.activeTextEditor;

  if (editor === undefined || editor.document.languageId !== 'markdown') {
    await vscode.window.showErrorMessage(
      'MD Image Uploader: Open a Markdown document before testing S3 upload.',
    );
    return;
  }

  const startedAt = Date.now();

  try {
    const config = readConfig(editor.document.uri, vscode.workspace);

    if (!config.enabled) {
      await vscode.window.showWarningMessage('MD Image Uploader is disabled.');
      return;
    }

    validateS3Config(config.s3);

    const objectKey = joinObjectKey(
      'md-image-uploader-test',
      `${Date.now()}.webp`,
    );
    const finalWebpBuffer = Buffer.from(testWebpBase64, 'base64');
    const client = createS3Client(config.s3);
    logger.info(
      translate('logTestStarted', config.s3.bucket, objectKey),
    );

    try {
      await vscode.window.withProgress(
        {
          location: vscode.ProgressLocation.Notification,
          title: 'MD Image Uploader: Testing S3 upload…',
        },
        () =>
          uploadWebp(client, {
            bucket: config.s3.bucket,
            objectKey,
            finalWebpBuffer,
          }),
      );
    } finally {
      client.destroy();
    }

    await vscode.window.showInformationMessage(
      `MD Image Uploader: Test upload succeeded: s3://${config.s3.bucket}/${objectKey}`,
    );
    logger.info(
      translate('logTestSucceeded', Date.now() - startedAt),
    );
  } catch (error) {
    logger.error(
      translate(
        'logTestFailed',
        Date.now() - startedAt,
        getErrorMessage(error),
      ),
    );
    await vscode.window.showErrorMessage(
      `MD Image Uploader: Test upload failed: ${getErrorMessage(error)}`,
    );
  }
}

function getErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
