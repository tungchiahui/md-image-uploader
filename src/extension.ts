import * as vscode from 'vscode';

import { ImagePasteHandler } from './imagePasteHandler';
import { registerImagePasteProvider } from './pasteProvider';
import { registerTestUploadCommand } from './testUploadCommand';

export function activate(context: vscode.ExtensionContext): void {
  registerImagePasteProvider(context, new ImagePasteHandler());
  registerTestUploadCommand(context);
  console.log('MD Image Uploader is active.');
}

export function deactivate(): void {
  // Command registrations are disposed through ExtensionContext subscriptions.
}
