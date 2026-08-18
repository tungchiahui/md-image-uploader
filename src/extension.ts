import * as vscode from 'vscode';

import { ImagePasteHandler } from './imagePasteHandler';
import { createTranslator } from './localization';
import { createOutputLogger } from './logging';
import { registerImagePasteProvider } from './pasteProvider';
import { registerTestUploadCommand } from './testUploadCommand';

export function activate(context: vscode.ExtensionContext): void {
  const translate = createTranslator(vscode.env.language);
  const logger = createOutputLogger(context);

  registerImagePasteProvider(
    context,
    new ImagePasteHandler({ logger, translate }),
    translate,
  );
  registerTestUploadCommand(context, logger, translate);
  logger.info(translate('logActivated'));
}

export function deactivate(): void {
  // Command registrations are disposed through ExtensionContext subscriptions.
}
