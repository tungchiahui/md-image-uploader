const assert = require('node:assert/strict');
const Module = require('node:module');
const test = require('node:test');

class DocumentDropOrPasteEditKind {
  constructor(value) {
    this.value = value;
  }

  append(...parts) {
    return new DocumentDropOrPasteEditKind(parts.join('.'));
  }
}

DocumentDropOrPasteEditKind.Empty = new DocumentDropOrPasteEditKind('');

class DocumentPasteEdit {}
class CancellationError extends Error {}

const pasteRegistrations = [];
const commandRegistrations = [];
const vscodeStub = {
  CancellationError,
  DocumentDropOrPasteEditKind,
  DocumentPasteEdit,
  commands: {
    registerCommand(command, handler) {
      commandRegistrations.push({ command, handler });
      return { dispose() {} };
    },
  },
  languages: {
    registerDocumentPasteEditProvider(selector, provider, metadata) {
      pasteRegistrations.push({ selector, provider, metadata });
      return { dispose() {} };
    },
  },
  window: {},
  workspace: {},
};

const originalLoad = Module._load;
let extensionModule;

try {
  Module._load = function loadWithVscodeStub(request, parent, isMain) {
    return request === 'vscode'
      ? vscodeStub
      : originalLoad.call(this, request, parent, isMain);
  };
  extensionModule = require('../dist/extension.js');
} finally {
  Module._load = originalLoad;
}

test('extension entry point activates the paste provider and test command', () => {
  const subscriptions = [];
  pasteRegistrations.length = 0;
  commandRegistrations.length = 0;

  extensionModule.activate({ subscriptions });

  assert.equal(pasteRegistrations.length, 1);
  assert.deepEqual(pasteRegistrations[0].selector, { language: 'markdown' });
  assert.equal(commandRegistrations.length, 1);
  assert.equal(
    commandRegistrations[0].command,
    'mdImageUploader.testUpload',
  );
  assert.equal(subscriptions.length, 2);
});
