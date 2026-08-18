const assert = require('node:assert/strict');
const test = require('node:test');

const sharp = require('sharp');

const { convertToWebp } = require('../dist/imageConverter.js');
const { hashFinalWebp } = require('../dist/hash.js');
const { processImagePaste } = require('../dist/pasteWorkflow.js');
const { uploadWebp } = require('../dist/s3Uploader.js');

const config = {
  enabled: true,
  s3: {
    endpoint: 'https://s3.example.com',
    region: 'ap-northeast-1',
    bucket: 'images',
    accessKeyId: 'access-key',
    secretAccessKey: 'secret-key',
    forcePathStyle: true,
  },
  datedUploadPath: 'wiki images/中文',
  undatedUploadPath: 'misc',
  cdnUrl: 'https://cdn.example.com/',
  webp: { quality: 85 },
};

const now = new Date(2026, 7, 18, 12, 34, 56, 789);

async function createPng() {
  return sharp({
    create: {
      width: 2,
      height: 2,
      channels: 4,
      background: { r: 20, g: 40, b: 60, alpha: 1 },
    },
  })
    .png()
    .toBuffer();
}

test('runs the complete dated paste workflow and hashes the uploaded WebP', async () => {
  let uploadedCommand;
  let destroyed = false;
  const progressEvents = [];
  const client = {
    async send(command) {
      uploadedCommand = command;
      return {};
    },
    destroy() {
      destroyed = true;
    },
  };

  const result = await processImagePaste(
    {
      inputBuffer: await createPng(),
      workspaceRelativePath:
        'wiki/2023-10-05-Cplusplus教学/0200-C++基础初识.md',
      config,
      now,
      onProgress(event) {
        progressEvents.push(event);
      },
    },
    {
      convertToWebp,
      hashFinalWebp,
      createS3Client: () => client,
      uploadWebp,
    },
  );

  const expectedKey =
    `wiki images/中文/2023/10/05/${now.getTime()}-${result.hash8}.webp`;
  assert.equal(result.objectKey, expectedKey);
  assert.equal(result.route, 'dated');
  assert.equal(result.pageDate.source, 'directory');
  assert.equal(
    result.cdnUrl,
    `https://cdn.example.com/wiki%20images/%E4%B8%AD%E6%96%87/2023/10/05/${now.getTime()}-${result.hash8}.webp`,
  );
  assert.equal(result.markdown, `![](${result.cdnUrl})`);
  assert.equal(uploadedCommand.input.Bucket, config.s3.bucket);
  assert.equal(uploadedCommand.input.Key, expectedKey);
  assert.equal(uploadedCommand.input.ContentType, 'image/webp');
  assert.equal(
    hashFinalWebp(uploadedCommand.input.Body).fullHash,
    result.fullHash,
  );
  assert.equal(destroyed, true);
  assert.deepEqual(progressEvents, [
    { stage: 'converting' },
    { stage: 'routing' },
    { stage: 'uploading', objectKey: expectedKey },
  ]);
});

test('routes an undated Markdown paste with the current local date', async () => {
  const finalWebpBuffer = Buffer.from('final-webp');
  const client = {
    async send() {
      return {};
    },
    destroy() {},
  };

  const result = await processImagePaste(
    {
      inputBuffer: Buffer.from('source'),
      workspaceRelativePath: 'docs/drivers/W311MI_AX300驱动.md',
      config,
      now,
    },
    {
      async convertToWebp() {
        return finalWebpBuffer;
      },
      hashFinalWebp,
      createS3Client: () => client,
      uploadWebp,
    },
  );

  assert.equal(result.route, 'undated');
  assert.equal(result.pageDate, undefined);
  assert.equal(
    result.objectKey,
    `misc/2026/08/18/${now.getTime()}-${result.hash8}.webp`,
  );
});

test('does not resolve Markdown until PutObject succeeds', async () => {
  let completeUpload;
  let settled = false;
  const uploadGate = new Promise((resolve) => {
    completeUpload = resolve;
  });
  const client = {
    async send() {
      await uploadGate;
      return {};
    },
    destroy() {},
  };

  const pendingResult = processImagePaste(
    {
      inputBuffer: Buffer.from('source'),
      workspaceRelativePath: 'docs/2026-01-14-article.md',
      config,
      now,
    },
    {
      async convertToWebp() {
        return Buffer.from('final-webp');
      },
      hashFinalWebp,
      createS3Client: () => client,
      uploadWebp,
    },
  ).then((result) => {
    settled = true;
    return result;
  });

  await new Promise((resolve) => setImmediate(resolve));
  assert.equal(settled, false);

  completeUpload();
  const result = await pendingResult;
  assert.equal(result.markdown.startsWith('![](https://'), true);
});

test('rejects without Markdown and destroys the client when upload fails', async () => {
  let destroyed = false;
  const client = {
    async send() {
      throw new Error('network unavailable');
    },
    destroy() {
      destroyed = true;
    },
  };

  await assert.rejects(
    processImagePaste(
      {
        inputBuffer: Buffer.from('source'),
        workspaceRelativePath: 'docs/2026-01-14-article.md',
        config,
        now,
      },
      {
        async convertToWebp() {
          return Buffer.from('final-webp');
        },
        hashFinalWebp,
        createS3Client: () => client,
        uploadWebp,
      },
    ),
    /network unavailable/,
  );
  assert.equal(destroyed, true);
});

test('does not create an S3 client when image conversion fails', async () => {
  let clientCreations = 0;

  await assert.rejects(
    processImagePaste(
      {
        inputBuffer: Buffer.from('source'),
        workspaceRelativePath: 'docs/2026-01-14-article.md',
        config,
        now,
      },
      {
        async convertToWebp() {
          throw new Error('conversion failed');
        },
        hashFinalWebp,
        createS3Client() {
          clientCreations += 1;
          throw new Error('unexpected client creation');
        },
        uploadWebp,
      },
    ),
    /conversion failed/,
  );
  assert.equal(clientCreations, 0);
});
