const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const repositoryRoot = path.join(__dirname, '..');
const packageJson = require('../package.json');
const vscodeIgnore = readFileSync(
  path.join(repositoryRoot, '.vscodeignore'),
  'utf8',
);

test('uses the tungchiahui Marketplace extension identity', () => {
  assert.equal(packageJson.publisher, 'tungchiahui');
  assert.equal(packageJson.name, 'md-image-uploader');
  assert.equal(
    `${packageJson.publisher}.${packageJson.name}`,
    'tungchiahui.md-image-uploader',
  );
});

test('declares the optimized extension icon', () => {
  assert.equal(packageJson.icon, 'assets/icon.png');
  assert.match(vscodeIgnore, /^assets\/icon-source\.png$/m);
});

test('defines reproducible Linux x64 VSIX package and verification scripts', () => {
  assert.match(packageJson.scripts['package:vsix'], /--target linux-x64/);
  assert.match(packageJson.scripts['verify:vsix'], /verifyVsix\.js/);
  assert.match(
    packageJson.scripts['verify:installed-vsix'],
    /verifyInstalledVsix\.js/,
  );
  assert.equal(
    packageJson.scripts['test:vsix'],
    'npm run package:vsix && npm run verify:vsix',
  );
});

test('declares the repository used to resolve relative README links', () => {
  assert.deepEqual(packageJson.repository, {
    type: 'git',
    url: 'https://github.com/tungchiahui/md-image-uploader.git',
  });
});

test('pins Sharp and its WASM backend as production dependencies', () => {
  assert.equal(packageJson.dependencies.sharp, '0.35.3');
  assert.equal(packageJson.dependencies['@img/sharp-wasm32'], '0.35.3');
  assert.equal(typeof packageJson.devDependencies['@vscode/vsce'], 'string');
  assert.equal(typeof packageJson.devDependencies['adm-zip'], 'string');
});

test('packages the WASM backend and excludes Electron-incompatible Linux binaries', () => {
  assert.doesNotMatch(vscodeIgnore, /^node_modules\/@img\/sharp-wasm32\/\*\*$/m);
  assert.match(vscodeIgnore, /^node_modules\/@img\/sharp-linux-x64\/\*\*$/m);
  assert.match(
    vscodeIgnore,
    /^node_modules\/@img\/sharp-libvips-linux-x64\/\*\*$/m,
  );
});

test('excludes development sources without excluding production node_modules', () => {
  assert.match(vscodeIgnore, /^src\/\*\*$/m);
  assert.match(vscodeIgnore, /^test\/\*\*$/m);
  assert.match(vscodeIgnore, /^\*\*\/\*\.map$/m);
  assert.doesNotMatch(vscodeIgnore, /^node_modules\/\*\*$/m);
});
