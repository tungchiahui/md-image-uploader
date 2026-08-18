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

test('keeps Sharp as a production dependency and VSIX tooling as development dependencies', () => {
  assert.equal(typeof packageJson.dependencies.sharp, 'string');
  assert.equal(typeof packageJson.devDependencies['@vscode/vsce'], 'string');
  assert.equal(typeof packageJson.devDependencies['adm-zip'], 'string');
});

test('excludes development sources without excluding production node_modules', () => {
  assert.match(vscodeIgnore, /^src\/\*\*$/m);
  assert.match(vscodeIgnore, /^test\/\*\*$/m);
  assert.match(vscodeIgnore, /^\*\*\/\*\.map$/m);
  assert.doesNotMatch(vscodeIgnore, /^node_modules\/\*\*$/m);
});
