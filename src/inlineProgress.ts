import * as vscode from 'vscode';

import {
  translateProgressStage,
  type Translate,
} from './localization';
import type { PasteProgressEvent } from './progress';

const successDisplayMilliseconds = 1_500;
const failureDisplayMilliseconds = 4_000;

export interface InlinePasteProgress {
  update(event: PasteProgressEvent): void;
  complete(): void;
  fail(): void;
  dispose(): void;
}

export type InlinePasteProgressFactory = (
  documentUri: vscode.Uri,
  ranges: readonly vscode.Range[],
  translate: Translate,
) => InlinePasteProgress;

export const createInlinePasteProgress: InlinePasteProgressFactory = (
  documentUri,
  ranges,
  translate,
) => new DecorationInlinePasteProgress(documentUri, ranges, translate);

class DecorationInlinePasteProgress implements InlinePasteProgress {
  private readonly decorationType =
    vscode.window.createTextEditorDecorationType({
      after: {
        margin: '0 0 0 0.75em',
        color: new vscode.ThemeColor('descriptionForeground'),
        fontStyle: 'italic',
      },
    });

  private cleanupTimer: NodeJS.Timeout | undefined;
  private disposed = false;

  public constructor(
    private readonly documentUri: vscode.Uri,
    private readonly ranges: readonly vscode.Range[],
    private readonly translate: Translate,
  ) {}

  public update(event: PasteProgressEvent): void {
    this.show(translateProgressStage(this.translate, event.stage));
  }

  public complete(): void {
    this.show(this.translate('progressComplete'));
    this.scheduleCleanup(successDisplayMilliseconds);
  }

  public fail(): void {
    this.show(this.translate('progressFailed'));
    this.scheduleCleanup(failureDisplayMilliseconds);
  }

  public dispose(): void {
    if (this.disposed) {
      return;
    }

    this.disposed = true;
    if (this.cleanupTimer !== undefined) {
      clearTimeout(this.cleanupTimer);
      this.cleanupTimer = undefined;
    }

    for (const editor of this.getVisibleEditors()) {
      editor.setDecorations(this.decorationType, []);
    }
    this.decorationType.dispose();
  }

  private show(message: string): void {
    if (this.disposed) {
      return;
    }

    const decorations: vscode.DecorationOptions[] = this.ranges.map(
      (range) => ({
        range,
        renderOptions: {
          after: { contentText: `  ${message}` },
        },
      }),
    );

    for (const editor of this.getVisibleEditors()) {
      editor.setDecorations(this.decorationType, decorations);
    }
  }

  private scheduleCleanup(milliseconds: number): void {
    if (this.cleanupTimer !== undefined) {
      clearTimeout(this.cleanupTimer);
    }
    this.cleanupTimer = setTimeout(() => this.dispose(), milliseconds);
    this.cleanupTimer.unref();
  }

  private getVisibleEditors(): readonly vscode.TextEditor[] {
    const targetUri = this.documentUri.toString();
    return vscode.window.visibleTextEditors.filter(
      (editor) => editor.document.uri.toString() === targetUri,
    );
  }
}
