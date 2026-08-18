import * as vscode from 'vscode';

export interface ExtensionLogger {
  info(message: string): void;
  error(message: string): void;
}

export const noopLogger: ExtensionLogger = {
  info(): void {},
  error(): void {},
};

export function createOutputLogger(
  context: vscode.ExtensionContext,
): ExtensionLogger {
  const channel = vscode.window.createOutputChannel('MD Image Uploader', {
    log: true,
  });
  context.subscriptions.push(channel);
  return channel;
}
