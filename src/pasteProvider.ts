import * as vscode from 'vscode';

import {
  IMAGE_PASTE_MIME_TYPES,
  type ImagePasteInput,
  extractFirstSupportedImage,
} from './pasteData';

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
  ): Promise<string | vscode.SnippetString>;
}

export class ImagePasteEdit extends vscode.DocumentPasteEdit {
  public constructor(
    public readonly documentUri: vscode.Uri,
    public readonly image: ImagePasteInput,
  ) {
    super('', 'Upload image with MD Image Uploader', imagePasteKind);
  }
}

export class ImagePasteProvider
  implements vscode.DocumentPasteEditProvider<ImagePasteEdit>
{
  public constructor(private readonly handler?: ImagePasteHandler) {}

  public async provideDocumentPasteEdits(
    document: vscode.TextDocument,
    _ranges: readonly vscode.Range[],
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

    return [new ImagePasteEdit(document.uri, image)];
  }

  public async resolveDocumentPasteEdit(
    pasteEdit: ImagePasteEdit,
    token: vscode.CancellationToken,
  ): Promise<ImagePasteEdit> {
    if (this.handler === undefined || token.isCancellationRequested) {
      return pasteEdit;
    }

    pasteEdit.insertText = await this.handler.resolve(
      pasteEdit.documentUri,
      pasteEdit.image,
      token,
    );
    return pasteEdit;
  }
}

export function registerImagePasteProvider(
  context: vscode.ExtensionContext,
  handler?: ImagePasteHandler,
): void {
  context.subscriptions.push(
    vscode.languages.registerDocumentPasteEditProvider(
      { language: 'markdown' },
      new ImagePasteProvider(handler),
      {
        providedPasteEditKinds: [imagePasteKind],
        pasteMimeTypes: IMAGE_PASTE_MIME_TYPES,
      },
    ),
  );
}
