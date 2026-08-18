const assert = require('node:assert/strict');
const Module = require('node:module');
const test = require('node:test');

class DocumentDropOrPasteEditKind {
  constructor(value) {
    this.value = value;
  }

  append(...parts) {
    const suffix = parts.join('.');
    return new DocumentDropOrPasteEditKind(
      this.value.length === 0 ? suffix : `${this.value}.${suffix}`,
    );
  }
}

DocumentDropOrPasteEditKind.Empty = new DocumentDropOrPasteEditKind('');

class DocumentPasteEdit {
  constructor(insertText, title, kind) {
    this.insertText = insertText;
    this.title = title;
    this.kind = kind;
  }
}

class TextEdit {
  static replace(range, newText) {
    return { range, newText };
  }
}

class WorkspaceEdit {
  constructor() {
    this.entries = [];
  }

  set(uri, edits) {
    this.entries.push([uri, edits]);
  }
}

const registrations = [];
const vscodeStub = {
  DocumentDropOrPasteEditKind,
  DocumentPasteEdit,
  TextEdit,
  WorkspaceEdit,
  languages: {
    registerDocumentPasteEditProvider(selector, provider, metadata) {
      registrations.push({ selector, provider, metadata });
      return { dispose() {} };
    },
  },
};

const originalLoad = Module._load;
let pasteProviderModule;

try {
  Module._load = function loadWithVscodeStub(request, parent, isMain) {
    return request === 'vscode'
      ? vscodeStub
      : originalLoad.call(this, request, parent, isMain);
  };
  pasteProviderModule = require('../dist/pasteProvider.js');
} finally {
  Module._load = originalLoad;
}

const {
  ImagePasteProvider,
  imagePasteKind,
  registerImagePasteProvider,
} = pasteProviderModule;

function createImageTransfer(bytes) {
  return [
    [
      'image/png',
      {
        value: undefined,
        asFile() {
          return {
            name: 'clipboard.png',
            async data() {
              return bytes;
            },
          };
        },
      },
    ],
  ];
}

const activeToken = { isCancellationRequested: false };
const pasteContext = { only: undefined, triggerKind: 0 };
const document = { uri: { path: '/workspace/article.md' } };
const pasteRange = {
  start: { line: 1, character: 2 },
  end: { line: 1, character: 2 },
};

test('constructs the required custom paste kind', () => {
  assert.equal(imagePasteKind.value, 'markdown.image.mdImageUploader');
});

test('registers only for Markdown with image and file MIME metadata', () => {
  registrations.length = 0;
  const subscriptions = [];

  registerImagePasteProvider({ subscriptions });

  assert.equal(registrations.length, 1);
  assert.deepEqual(registrations[0].selector, { language: 'markdown' });
  assert.deepEqual(registrations[0].metadata.pasteMimeTypes, [
    'image/*',
    'files',
  ]);
  assert.equal(
    registrations[0].metadata.providedPasteEditKinds[0].value,
    'markdown.image.mdImageUploader',
  );
  assert.equal(subscriptions.length, 1);
});

test('does not claim image paste without a handler', async () => {
  let dataReads = 0;
  const provider = new ImagePasteProvider();
  const transfer = createImageTransfer({
    [Symbol.iterator]: function* iterate() {
      dataReads += 1;
      yield 1;
    },
  });

  const edits = await provider.provideDocumentPasteEdits(
    document,
    [pasteRange],
    transfer,
    pasteContext,
    activeToken,
  );

  assert.deepEqual(edits, []);
  assert.equal(dataReads, 0);
});

test('copies image bytes before resolving the final paste text', async () => {
  const sourceBytes = Uint8Array.from([1, 2, 3]);
  const resolverCalls = [];
  const provider = new ImagePasteProvider({
    canHandle: () => true,
    async resolve(documentUri, image) {
      resolverCalls.push({ documentUri, image });
      return '![](https://cdn.example.com/image.webp)';
    },
  });

  const edits = await provider.provideDocumentPasteEdits(
    document,
    [pasteRange],
    createImageTransfer(sourceBytes),
    pasteContext,
    activeToken,
  );
  sourceBytes[0] = 99;
  const resolvedEdit = await provider.resolveDocumentPasteEdit(
    edits[0],
    activeToken,
  );

  assert.equal(edits.length, 1);
  assert.deepEqual(edits[0].image.inputBuffer, Buffer.from([1, 2, 3]));
  assert.equal(resolverCalls[0].documentUri, document.uri);
  assert.equal(resolvedEdit.insertText, '');
  assert.deepEqual(resolvedEdit.additionalEdit.entries, [
    [
      document.uri,
      [
        {
          range: pasteRange,
          newText: '![](https://cdn.example.com/image.webp)',
        },
      ],
    ],
  ]);
});

test('returns no edit for ordinary text even when a handler exists', async () => {
  let resolverCalls = 0;
  const provider = new ImagePasteProvider({
    canHandle: () => true,
    async resolve() {
      resolverCalls += 1;
      return 'unexpected';
    },
  });
  const textTransfer = [
    [
      'text/plain',
      {
        value: 'hello',
        asFile() {
          return undefined;
        },
      },
    ],
  ];

  const edits = await provider.provideDocumentPasteEdits(
    document,
    [pasteRange],
    textTransfer,
    pasteContext,
    activeToken,
  );

  assert.deepEqual(edits, []);
  assert.equal(resolverCalls, 0);
});

test('does not read or claim image data when the handler is disabled', async () => {
  let dataReads = 0;
  const provider = new ImagePasteProvider({
    canHandle: () => false,
    async resolve() {
      return 'unexpected';
    },
  });
  const transfer = createImageTransfer({
    [Symbol.iterator]: function* iterate() {
      dataReads += 1;
      yield 1;
    },
  });

  const edits = await provider.provideDocumentPasteEdits(
    document,
    [pasteRange],
    transfer,
    pasteContext,
    activeToken,
  );

  assert.deepEqual(edits, []);
  assert.equal(dataReads, 0);
});
