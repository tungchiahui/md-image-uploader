const assert = require('node:assert/strict');
const Module = require('node:module');
const test = require('node:test');

class CancellationError extends Error {}

const configurationValues = {
  enabled: true,
  's3.endpoint': 'https://s3.example.com',
  's3.region': 'ap-northeast-1',
  's3.bucket': 'images',
  's3.accessKeyId': 'access-key',
  's3.secretAccessKey': 'secret-key',
  's3.forcePathStyle': true,
  datedUploadPath: 'wiki',
  undatedUploadPath: 'misc',
  cdnUrl: 'https://cdn.example.com',
  'webp.quality': 85,
};
const configurationReads = [];
const relativePathReads = [];
const shownMessages = [];
const vscodeStub = {
  CancellationError,
  window: {
    async showErrorMessage(message) {
      shownMessages.push(message);
    },
  },
  workspace: {
    getConfiguration(section, scope) {
      configurationReads.push({ section, scope });
      return {
        get(key, fallback) {
          return Object.hasOwn(configurationValues, key)
            ? configurationValues[key]
            : fallback;
        },
      };
    },
    getWorkspaceFolder(uri) {
      return uri.inWorkspace ? { uri: { path: '/workspace' } } : undefined;
    },
    asRelativePath(uri, includeWorkspaceFolder) {
      relativePathReads.push({ uri, includeWorkspaceFolder });
      return uri.relativePath;
    },
  },
};

const originalLoad = Module._load;
let handlerModule;

try {
  Module._load = function loadWithVscodeStub(request, parent, isMain) {
    return request === 'vscode'
      ? vscodeStub
      : originalLoad.call(this, request, parent, isMain);
  };
  handlerModule = require('../dist/imagePasteHandler.js');
} finally {
  Module._load = originalLoad;
}

const { ImagePasteHandler, getWorkspaceRelativePath } = handlerModule;
const { createTranslator } = require('../dist/localization.js');

test('checks enabled using configuration scoped to the Markdown URI', () => {
  configurationReads.length = 0;
  const documentUri = {
    path: '/workspace/docs/article.md',
    inWorkspace: true,
  };

  assert.equal(new ImagePasteHandler().canHandle(documentUri), true);
  assert.deepEqual(configurationReads, [
    { section: 'mdImageUploader', scope: documentUri },
  ]);
});

test('derives the Markdown workspace-relative path without the folder name', () => {
  relativePathReads.length = 0;
  const documentUri = {
    path: '/workspace/docs/article.md',
    relativePath: 'docs/article.md',
    inWorkspace: true,
  };

  assert.equal(getWorkspaceRelativePath(documentUri), 'docs/article.md');
  assert.deepEqual(relativePathReads, [
    { uri: documentUri, includeWorkspaceFolder: false },
  ]);
});

test('falls back to the Markdown basename outside a workspace', () => {
  assert.equal(
    getWorkspaceRelativePath({
      path: '/tmp/2026-01-14-article.md',
      inWorkspace: false,
    }),
    '2026-01-14-article.md',
  );
});

test('passes scoped config and the workspace-relative path to the workflow', async () => {
  const pasteWorkflow = require('../dist/pasteWorkflow.js');
  const originalProcessImagePaste = pasteWorkflow.processImagePaste;
  const inputBuffer = Buffer.from([1, 2, 3]);
  const documentUri = {
    path: '/workspace/docs/2026-01-14-article.md',
    relativePath: 'docs/2026-01-14-article.md',
    inWorkspace: true,
  };
  let workflowOptions;

  pasteWorkflow.processImagePaste = async (options) => {
    workflowOptions = options;
    return { markdown: '![](https://cdn.example.com/image.webp)' };
  };

  try {
    const markdown = await new ImagePasteHandler().resolve(
      documentUri,
      { inputBuffer, mimeType: 'image/png', fileName: 'clipboard.png' },
      { isCancellationRequested: false },
    );

    assert.equal(markdown, '![](https://cdn.example.com/image.webp)');
    assert.equal(workflowOptions.inputBuffer, inputBuffer);
    assert.equal(
      workflowOptions.workspaceRelativePath,
      'docs/2026-01-14-article.md',
    );
    assert.equal(workflowOptions.config.s3.bucket, 'images');
    assert.equal(workflowOptions.now instanceof Date, true);
  } finally {
    pasteWorkflow.processImagePaste = originalProcessImagePaste;
  }
});

test('logs safe paste metadata, progress stages, object key, and duration', async () => {
  const pasteWorkflow = require('../dist/pasteWorkflow.js');
  const originalProcessImagePaste = pasteWorkflow.processImagePaste;
  const logEntries = [];
  const progressEvents = [];
  const logger = {
    info(message) {
      logEntries.push({ level: 'info', message });
    },
    error(message) {
      logEntries.push({ level: 'error', message });
    },
  };

  pasteWorkflow.processImagePaste = async (options) => {
    options.onProgress({ stage: 'converting' });
    options.onProgress({ stage: 'routing' });
    options.onProgress({
      stage: 'uploading',
      objectKey: 'wiki/2026/01/14/12345678-deadbeef.webp',
    });
    return {
      markdown: '![](https://cdn.example.com/image.webp)',
      objectKey: 'wiki/2026/01/14/12345678-deadbeef.webp',
    };
  };

  try {
    const handler = new ImagePasteHandler({
      logger,
      translate: createTranslator('en'),
    });
    await handler.resolve(
      {
        path: '/workspace/docs/2026-01-14-article.md',
        relativePath: 'docs/2026-01-14-article.md',
        inWorkspace: true,
      },
      {
        inputBuffer: Buffer.from([1, 2, 3]),
        mimeType: 'image/png',
        fileName: 'clipboard.png',
      },
      { isCancellationRequested: false },
      (event) => progressEvents.push(event),
    );

    assert.equal(logEntries.length, 5);
    assert.match(logEntries[0].message, /document=docs\/2026-01-14-article\.md/);
    assert.match(logEntries[0].message, /mimeType=image\/png/);
    assert.match(logEntries[0].message, /inputBytes=3/);
    assert.match(logEntries[3].message, /objectKey=wiki\/2026\/01\/14/);
    assert.match(logEntries[4].message, /Paste succeeded in \d+ ms/);
    assert.equal(
      logEntries.some(({ message }) =>
        message.includes(configurationValues['s3.secretAccessKey']),
      ),
      false,
    );
    assert.deepEqual(progressEvents, [
      { stage: 'converting' },
      { stage: 'routing' },
      {
        stage: 'uploading',
        objectKey: 'wiki/2026/01/14/12345678-deadbeef.webp',
      },
    ]);
  } finally {
    pasteWorkflow.processImagePaste = originalProcessImagePaste;
  }
});

test('shows a classified error, rethrows it, and returns no Markdown', async () => {
  const pasteWorkflow = require('../dist/pasteWorkflow.js');
  const originalProcessImagePaste = pasteWorkflow.processImagePaste;
  const failure = new Error('unexpected workflow failure');
  shownMessages.length = 0;

  pasteWorkflow.processImagePaste = async () => {
    throw failure;
  };

  try {
    await assert.rejects(
      () =>
        new ImagePasteHandler().resolve(
          {
            path: '/workspace/docs/article.md',
            relativePath: 'docs/article.md',
            inWorkspace: true,
          },
          {
            inputBuffer: Buffer.from([1]),
            mimeType: 'image/png',
            fileName: 'clipboard.png',
          },
          { isCancellationRequested: false },
        ),
      (error) => error === failure,
    );
    assert.deepEqual(shownMessages, [
      'MD Image Uploader: Paste failed: unexpected workflow failure',
    ]);
  } finally {
    pasteWorkflow.processImagePaste = originalProcessImagePaste;
  }
});

test('reports missing scoped configuration before starting the workflow', async () => {
  const pasteWorkflow = require('../dist/pasteWorkflow.js');
  const originalProcessImagePaste = pasteWorkflow.processImagePaste;
  const originalBucket = configurationValues['s3.bucket'];
  let workflowCalls = 0;
  configurationValues['s3.bucket'] = '';
  shownMessages.length = 0;

  pasteWorkflow.processImagePaste = async () => {
    workflowCalls += 1;
    return { markdown: 'unexpected' };
  };

  try {
    await assert.rejects(
      () =>
        new ImagePasteHandler().resolve(
          {
            path: '/workspace/docs/article.md',
            relativePath: 'docs/article.md',
            inWorkspace: true,
          },
          {
            inputBuffer: Buffer.from([1]),
            mimeType: 'image/png',
            fileName: 'clipboard.png',
          },
          { isCancellationRequested: false },
        ),
      /Missing setting "s3.bucket"/,
    );
    assert.equal(workflowCalls, 0);
    assert.deepEqual(shownMessages, [
      'MD Image Uploader: Missing setting "s3.bucket"',
    ]);
  } finally {
    configurationValues['s3.bucket'] = originalBucket;
    pasteWorkflow.processImagePaste = originalProcessImagePaste;
  }
});
