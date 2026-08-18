const assert = require('node:assert/strict');
const Module = require('node:module');
const test = require('node:test');

class ThemeColor {
  constructor(id) {
    this.id = id;
  }
}

const decorationCalls = [];
let decorationDisposed = false;
const documentUri = { toString: () => 'file:///workspace/article.md' };
const editor = {
  document: { uri: documentUri },
  setDecorations(decorationType, decorations) {
    decorationCalls.push({ decorationType, decorations });
  },
};
const vscodeStub = {
  ThemeColor,
  window: {
    visibleTextEditors: [editor],
    createTextEditorDecorationType(options) {
      return {
        options,
        dispose() {
          decorationDisposed = true;
        },
      };
    },
  },
};

const originalLoad = Module._load;
let inlineProgressModule;

try {
  Module._load = function loadWithVscodeStub(request, parent, isMain) {
    return request === 'vscode'
      ? vscodeStub
      : originalLoad.call(this, request, parent, isMain);
  };
  inlineProgressModule = require('../dist/inlineProgress.js');
} finally {
  Module._load = originalLoad;
}

const { createInlinePasteProgress } = inlineProgressModule;
const { createTranslator } = require('../dist/localization.js');

test('shows localized progress beside the paste range and cleans it up', () => {
  decorationCalls.length = 0;
  decorationDisposed = false;
  const range = {
    start: { line: 4, character: 0 },
    end: { line: 4, character: 0 },
  };
  const progress = createInlinePasteProgress(
    documentUri,
    [range],
    createTranslator('zh-cn'),
  );

  progress.update({ stage: 'converting' });

  assert.equal(decorationCalls.length, 1);
  assert.equal(decorationCalls[0].decorations[0].range, range);
  assert.match(
    decorationCalls[0].decorations[0].renderOptions.after.contentText,
    /正在将图片转换为 WebP/,
  );

  progress.dispose();

  assert.deepEqual(decorationCalls.at(-1).decorations, []);
  assert.equal(decorationDisposed, true);
});
