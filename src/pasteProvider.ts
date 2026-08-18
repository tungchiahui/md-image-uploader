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

export type ImagePasteResolver = (
  documentUri: vscode.Uri,
  image: ImagePasteInput,
  token: vscode.CancellationToken,
) => Promise<string | vscode.SnippetString>;

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
  public constructor(private readonly resolver?: ImagePasteResolver) {}

  public async provideDocumentPasteEdits(
    document: vscode.TextDocument,
    _ranges: readonly vscode.Range[],
    dataTransfer: vscode.DataTransfer,
    _context: vscode.DocumentPasteEditContext,
    token: vscode.CancellationToken,
  ): Promise<ImagePasteEdit[]> {
    if (this.resolver === undefined || token.isCancellationRequested) {
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
    if (this.resolver === undefined || token.isCancellationRequested) {
      return pasteEdit;
    }

    pasteEdit.insertText = await this.resolver(
      pasteEdit.documentUri,
      pasteEdit.image,
      token,
    );
    return pasteEdit;
  }
}

export function registerImagePasteProvider(
  context: vscode.ExtensionContext,
  resolver?: ImagePasteResolver,
): void {
  context.subscriptions.push(
    vscode.languages.registerDocumentPasteEditProvider(
      { language: 'markdown' },
      new ImagePasteProvider(resolver),
      {
        providedPasteEditKinds: [imagePasteKind],
        pasteMimeTypes: IMAGE_PASTE_MIME_TYPES,
      },
    ),
  );
}
