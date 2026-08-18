import * as vscode from 'vscode';

import { registerTestUploadCommand } from './testUploadCommand';

export function activate(context: vscode.ExtensionContext): void {
  registerTestUploadCommand(context);
  console.log('MD Image Uploader is active.');
}

export function deactivate(): void {
  // Command registrations are disposed through ExtensionContext subscriptions.
}
