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
const vscodeStub = {
  CancellationError,
  window: {
    async showErrorMessage() {},
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
