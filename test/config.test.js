const assert = require('node:assert/strict');
const test = require('node:test');

const {
  CONFIG_NAMESPACE,
  ConfigValidationError,
  getValidatedConfig,
  readConfig,
  validateConfig,
  validateS3Config,
} = require('../dist/config.js');

const completeValues = {
  enabled: true,
  's3.endpoint': 'https://s3.example.com',
  's3.region': 'ap-northeast-1',
  's3.bucket': 'images',
  's3.accessKeyId': 'ACCESS_KEY',
  's3.secretAccessKey': 'SECRET_KEY',
  's3.forcePathStyle': true,
  datedUploadPath: 'wiki',
  undatedUploadPath: 'misc',
  cdnUrl: 'https://cdn.example.com',
  'webp.quality': 85,
};

function createWorkspace(valuesByResource) {
  const calls = [];

  return {
    calls,
    getConfiguration(section, resource) {
      calls.push({ section, resource });
      const values = valuesByResource.get(resource) ?? {};

      return {
        get(key, defaultValue) {
          return Object.hasOwn(values, key) ? values[key] : defaultValue;
        },
      };
    },
  };
}

function createValidConfig(overrides = {}) {
  const {
    s3: s3Overrides = {},
    webp: webpOverrides = {},
    ...rootOverrides
  } = overrides;

  return {
    enabled: true,
    s3: {
      endpoint: 'https://s3.example.com',
      region: 'ap-northeast-1',
      bucket: 'images',
      accessKeyId: 'ACCESS_KEY',
      secretAccessKey: 'SECRET_KEY',
      forcePathStyle: false,
      ...s3Overrides,
    },
    datedUploadPath: 'markdown',
    undatedUploadPath: 'misc',
    cdnUrl: 'https://cdn.example.com',
    webp: {
      quality: 85,
      ...webpOverrides,
    },
    ...rootOverrides,
  };
}

test('readConfig uses the document URI as the resource scope', () => {
  const documentUri = { path: '/repo-a/README.md' };
  const workspace = createWorkspace(
    new Map([[documentUri, completeValues]]),
  );

  const config = readConfig(documentUri, workspace);

  assert.deepEqual(workspace.calls, [
    { section: CONFIG_NAMESPACE, resource: documentUri },
  ]);
  assert.deepEqual(config, {
    enabled: true,
    s3: {
      endpoint: 'https://s3.example.com',
      region: 'ap-northeast-1',
      bucket: 'images',
      accessKeyId: 'ACCESS_KEY',
      secretAccessKey: 'SECRET_KEY',
      forcePathStyle: true,
    },
    datedUploadPath: 'wiki',
    undatedUploadPath: 'misc',
    cdnUrl: 'https://cdn.example.com',
    webp: { quality: 85 },
  });
});

test('readConfig applies declared defaults when settings are absent', () => {
  const documentUri = { path: '/repo/README.md' };
  const workspace = createWorkspace(new Map([[documentUri, {}]]));

  assert.deepEqual(readConfig(documentUri, workspace), {
    enabled: true,
    s3: {
      endpoint: '',
      region: '',
      bucket: '',
      accessKeyId: '',
      secretAccessKey: '',
      forcePathStyle: false,
    },
    datedUploadPath: 'markdown',
    undatedUploadPath: 'misc',
    cdnUrl: '',
    webp: { quality: 85 },
  });
});

test('resource-scoped reads allow different workspace folder overrides', () => {
  const repoAUri = { path: '/repo-a/article.md' };
  const repoBUri = { path: '/repo-b/article.md' };
  const workspace = createWorkspace(
    new Map([
      [repoAUri, { ...completeValues, datedUploadPath: 'repo-a' }],
      [repoBUri, { ...completeValues, datedUploadPath: 'repo-b' }],
    ]),
  );

  assert.equal(readConfig(repoAUri, workspace).datedUploadPath, 'repo-a');
  assert.equal(readConfig(repoBUri, workspace).datedUploadPath, 'repo-b');
});

test('validateConfig accepts a complete valid configuration', () => {
  const config = createValidConfig();

  assert.equal(validateConfig(config), config);
});

test('validateConfig does not require upload settings when disabled', () => {
  const config = createValidConfig({
    enabled: false,
    s3: {
      endpoint: '',
      region: '',
      bucket: '',
      accessKeyId: '',
      secretAccessKey: '',
    },
    datedUploadPath: '',
    undatedUploadPath: '',
    cdnUrl: '',
  });

  assert.equal(validateConfig(config), config);
});

for (const [setting, mutate] of [
  ['s3.region', (config) => { config.s3.region = ' '; }],
  ['s3.bucket', (config) => { config.s3.bucket = ''; }],
  ['s3.accessKeyId', (config) => { config.s3.accessKeyId = ''; }],
  ['s3.secretAccessKey', (config) => { config.s3.secretAccessKey = ''; }],
  ['datedUploadPath', (config) => { config.datedUploadPath = ''; }],
  ['undatedUploadPath', (config) => { config.undatedUploadPath = ''; }],
  ['cdnUrl', (config) => { config.cdnUrl = ''; }],
]) {
  test(`validateConfig reports missing setting ${setting}`, () => {
    const config = createValidConfig();
    mutate(config);

    assert.throws(
      () => validateConfig(config),
      (error) =>
        error instanceof ConfigValidationError &&
        error.message === `Missing setting "${setting}"` &&
        error.setting === setting,
    );
  });
}

test('validateConfig accepts an empty optional S3 endpoint', () => {
  const config = createValidConfig({ s3: { endpoint: '' } });

  assert.equal(validateConfig(config), config);
});

for (const [setting, config] of [
  ['s3.endpoint', createValidConfig({ s3: { endpoint: 'not-a-url' } })],
  ['cdnUrl', createValidConfig({ cdnUrl: 'file:///tmp/images' })],
]) {
  test(`validateConfig rejects invalid URL setting ${setting}`, () => {
    assert.throws(
      () => validateConfig(config),
      (error) =>
        error instanceof ConfigValidationError && error.setting === setting,
    );
  });
}

for (const quality of [1, 100]) {
  test(`validateConfig accepts WebP quality ${quality}`, () => {
    const config = createValidConfig({ webp: { quality } });

    assert.equal(validateConfig(config), config);
  });
}

for (const quality of [0, 101, 85.5, Number.NaN]) {
  test(`validateConfig rejects WebP quality ${quality}`, () => {
    const config = createValidConfig({ webp: { quality } });

    assert.throws(
      () => validateConfig(config),
      (error) =>
        error instanceof ConfigValidationError &&
        error.setting === 'webp.quality',
    );
  });
}

test('getValidatedConfig combines scoped reading and validation', () => {
  const documentUri = { path: '/repo/article.md' };
  const workspace = createWorkspace(
    new Map([[documentUri, completeValues]]),
  );

  const config = getValidatedConfig(documentUri, workspace);

  assert.equal(config.s3.bucket, 'images');
  assert.deepEqual(workspace.calls, [
    { section: CONFIG_NAMESPACE, resource: documentUri },
  ]);
});

test('validateS3Config validates S3 independently for the test command', () => {
  const s3Config = createValidConfig().s3;

  assert.equal(validateS3Config(s3Config), s3Config);
});
