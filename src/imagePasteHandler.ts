import * as vscode from 'vscode';

import { getValidatedConfig, readConfig } from './config';
import type { ImagePasteInput } from './pasteData';
import type { ImagePasteHandler as PasteHandler } from './pasteProvider';
import { processImagePaste } from './pasteWorkflow';

export class ImagePasteHandler implements PasteHandler {
  public canHandle(documentUri: vscode.Uri): boolean {
    return readConfig(documentUri, vscode.workspace).enabled;
  }

  public async resolve(
    documentUri: vscode.Uri,
    image: ImagePasteInput,
    token: vscode.CancellationToken,
  ): Promise<string> {
    if (token.isCancellationRequested) {
      throw new vscode.CancellationError();
    }

    try {
      const config = getValidatedConfig(documentUri, vscode.workspace);

      if (!config.enabled) {
        throw new vscode.CancellationError();
      }

      const result = await processImagePaste({
        inputBuffer: image.inputBuffer,
        workspaceRelativePath: getWorkspaceRelativePath(documentUri),
        config,
        now: new Date(),
      });

      if (token.isCancellationRequested) {
        throw new vscode.CancellationError();
      }

      return result.markdown;
    } catch (error) {
      if (error instanceof vscode.CancellationError) {
        throw error;
      }

      const reason = error instanceof Error ? error.message : String(error);
      await vscode.window.showErrorMessage(
        `MD Image Uploader: Paste failed: ${reason}`,
      );
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
