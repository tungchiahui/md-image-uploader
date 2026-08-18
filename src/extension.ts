import * as vscode from 'vscode';

export function activate(context: vscode.ExtensionContext): void {
  void context;
  console.log('MD Image Uploader is active.');
}

export function deactivate(): void {
  // No resources need to be disposed during the initialization stage.
}
