import * as vscode from 'vscode';

import {
  IMAGE_PASTE_MIME_TYPES,
  type ImagePasteInput,
  extractFirstSupportedImage,
} from './pasteData';
import {
  createInlinePasteProgress,
  type InlinePasteProgressFactory,
} from './inlineProgress';
import { createTranslator, type Translate } from './localization';
import type { PasteProgressReporter } from './progress';

export const imagePasteKind = vscode.DocumentDropOrPasteEditKind.Empty.append(
  'markdown',
  'image',
  'mdImageUploader',
);

export interface ImagePasteHandler {
  canHandle(documentUri: vscode.Uri): boolean;
  resolve(
    documentUri: vscode.Uri,
    image: ImagePasteInput,
    token: vscode.CancellationToken,
    onProgress?: PasteProgressReporter,
  ): Promise<string>;
}

export class ImagePasteEdit extends vscode.DocumentPasteEdit {
  public constructor(
    public readonly documentUri: vscode.Uri,
    public readonly image: ImagePasteInput,
    public readonly ranges: readonly vscode.Range[],
  ) {
    super('', 'Upload image with MD Image Uploader', imagePasteKind);
  }
}

export class ImagePasteProvider
  implements vscode.DocumentPasteEditProvider<ImagePasteEdit>
{
  public constructor(
    private readonly handler?: ImagePasteHandler,
    private readonly translate: Translate = createTranslator('en'),
    private readonly progressFactory: InlinePasteProgressFactory =
      createInlinePasteProgress,
  ) {}

  public async provideDocumentPasteEdits(
    document: vscode.TextDocument,
    ranges: readonly vscode.Range[],
    dataTransfer: vscode.DataTransfer,
    _context: vscode.DocumentPasteEditContext,
    token: vscode.CancellationToken,
  ): Promise<ImagePasteEdit[]> {
    if (
      this.handler === undefined ||
      token.isCancellationRequested ||
      !this.handler.canHandle(document.uri)
    ) {
      return [];
    }

    const image = await extractFirstSupportedImage(dataTransfer, token);

    if (image === undefined || token.isCancellationRequested) {
      return [];
    }

    return [new ImagePasteEdit(document.uri, image, [...ranges])];
  }

  public async resolveDocumentPasteEdit(
    pasteEdit: ImagePasteEdit,
    token: vscode.CancellationToken,
  ): Promise<ImagePasteEdit> {
    if (this.handler === undefined || token.isCancellationRequested) {
      return pasteEdit;
    }

    const progress = this.progressFactory(
      pasteEdit.documentUri,
      pasteEdit.ranges,
      this.translate,
    );
    progress.update({ stage: 'preparing' });

    try {
      const markdown = await this.handler.resolve(
        pasteEdit.documentUri,
        pasteEdit.image,
        token,
        (event) => progress.update(event),
      );
      const additionalEdit = new vscode.WorkspaceEdit();
      additionalEdit.set(
        pasteEdit.documentUri,
        pasteEdit.ranges.map((range) =>
          vscode.TextEdit.replace(range, markdown),
        ),
      );
      pasteEdit.additionalEdit = additionalEdit;
      progress.complete();
      return pasteEdit;
    } catch (error) {
      if (token.isCancellationRequested) {
        progress.dispose();
      } else {
        progress.fail();
      }
      throw error;
    }
  }
}

export function registerImagePasteProvider(
  context: vscode.ExtensionContext,
  handler?: ImagePasteHandler,
  translate: Translate = createTranslator('en'),
): void {
  context.subscriptions.push(
    vscode.languages.registerDocumentPasteEditProvider(
      { language: 'markdown' },
      new ImagePasteProvider(handler, translate),
      {
        providedPasteEditKinds: [imagePasteKind],
        pasteMimeTypes: IMAGE_PASTE_MIME_TYPES,
      },
    ),
  );
}
