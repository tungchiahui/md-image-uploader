import * as vscode from 'vscode';

import { getValidatedConfig, readConfig } from './config';
import { formatPasteError } from './errorMessages';
import {
  createTranslator,
  translateProgressStage,
  type Translate,
} from './localization';
import { noopLogger, type ExtensionLogger } from './logging';
import type { ImagePasteInput } from './pasteData';
import type { ImagePasteHandler as PasteHandler } from './pasteProvider';
import { processImagePaste } from './pasteWorkflow';
import type { PasteProgressReporter } from './progress';

export interface ImagePasteHandlerOptions {
  logger?: ExtensionLogger;
  translate?: Translate;
}

export class ImagePasteHandler implements PasteHandler {
  private readonly logger: ExtensionLogger;
  private readonly translate: Translate;

  public constructor(options: ImagePasteHandlerOptions = {}) {
    this.logger = options.logger ?? noopLogger;
    this.translate = options.translate ?? createTranslator('en');
  }

  public canHandle(documentUri: vscode.Uri): boolean {
    return readConfig(documentUri, vscode.workspace).enabled;
  }

  public async resolve(
    documentUri: vscode.Uri,
    image: ImagePasteInput,
    token: vscode.CancellationToken,
    onProgress?: PasteProgressReporter,
  ): Promise<string> {
    if (token.isCancellationRequested) {
      throw new vscode.CancellationError();
    }

    const startedAt = Date.now();
    const workspaceRelativePath = getWorkspaceRelativePath(documentUri);
    this.logger.info(
      this.translate(
        'logPasteStarted',
        workspaceRelativePath,
        image.mimeType,
        image.inputBuffer.length,
      ),
    );

    try {
      const config = getValidatedConfig(documentUri, vscode.workspace);

      if (!config.enabled) {
        throw new vscode.CancellationError();
      }

      const result = await processImagePaste({
        inputBuffer: image.inputBuffer,
        workspaceRelativePath,
        config,
        now: new Date(),
        onProgress: (event) => {
          const stageMessage = translateProgressStage(
            this.translate,
            event.stage,
          );
          this.logger.info(
            event.objectKey === undefined
              ? this.translate('logPasteStage', stageMessage)
              : this.translate(
                  'logPasteUploading',
                  stageMessage,
                  event.objectKey,
                ),
          );
          onProgress?.(event);
        },
      });

      if (token.isCancellationRequested) {
        throw new vscode.CancellationError();
      }

      this.logger.info(
        this.translate(
          'logPasteSucceeded',
          Date.now() - startedAt,
          result.objectKey,
        ),
      );
      return result.markdown;
    } catch (error) {
      if (error instanceof vscode.CancellationError) {
        throw error;
      }

      const formattedError = formatPasteError(error);
      this.logger.error(
        this.translate(
          'logPasteFailed',
          Date.now() - startedAt,
          formattedError,
        ),
      );
      void vscode.window.showErrorMessage(formattedError);
      throw error;
    }
  }
}

export function getWorkspaceRelativePath(documentUri: vscode.Uri): string {
  if (vscode.workspace.getWorkspaceFolder(documentUri) !== undefined) {
    return vscode.workspace.asRelativePath(documentUri, false);
  }

  const normalizedPath = documentUri.path.replaceAll('\\', '/');
  return normalizedPath.slice(normalizedPath.lastIndexOf('/') + 1);
}
