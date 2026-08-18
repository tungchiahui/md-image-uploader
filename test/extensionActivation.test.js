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
const outputChannels = [];
const vscodeStub = {
  CancellationError,
  DocumentDropOrPasteEditKind,
  DocumentPasteEdit,
  env: { language: 'zh-cn' },
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
  window: {
    createOutputChannel(name, options) {
      const messages = [];
      const channel = {
        name,
        options,
        messages,
        info(message) {
          messages.push({ level: 'info', message });
        },
        error(message) {
          messages.push({ level: 'error', message });
        },
        dispose() {},
      };
      outputChannels.push(channel);
      return channel;
    },
  },
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
  outputChannels.length = 0;

  extensionModule.activate({ subscriptions });

  assert.equal(pasteRegistrations.length, 1);
  assert.deepEqual(pasteRegistrations[0].selector, { language: 'markdown' });
  assert.equal(commandRegistrations.length, 1);
  assert.equal(
    commandRegistrations[0].command,
    'mdImageUploader.testUpload',
  );
  assert.equal(outputChannels.length, 1);
  assert.equal(outputChannels[0].name, 'MD Image Uploader');
  assert.deepEqual(outputChannels[0].options, { log: true });
  assert.match(outputChannels[0].messages[0].message, /扩展已激活/);
  assert.equal(subscriptions.length, 3);
});
