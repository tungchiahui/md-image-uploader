const assert = require('node:assert/strict');
const { spawnSync } = require('node:child_process');
const {
  existsSync,
  mkdtempSync,
  readdirSync,
  rmSync,
} = require('node:fs');
const { tmpdir } = require('node:os');
const path = require('node:path');

const tinyPng = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=',
  'base64',
);

async function main() {
  const artifactArgument = process.argv[2];
  assert.ok(
    artifactArgument,
    'Usage: node scripts/verifyInstalledVsix.js <file.vsix>',
  );

  const artifactPath = path.resolve(artifactArgument);
  assert.ok(existsSync(artifactPath), `VSIX not found: ${artifactPath}`);

  const testRoot = mkdtempSync(
    path.join(tmpdir(), 'md-image-uploader-installed-vsix-'),
  );
  const extensionsDirectory = path.join(testRoot, 'extensions');
  const userDataDirectory = path.join(testRoot, 'user-data');

  try {
    runCode([
      '--install-extension',
      artifactPath,
      '--extensions-dir',
      extensionsDirectory,
      '--user-data-dir',
      userDataDirectory,
      '--force',
    ]);

    const installedDirectoryName = readdirSync(extensionsDirectory).find(
      (entryName) =>
        entryName.startsWith('tungchiahui.md-image-uploader-'),
    );
    assert.ok(installedDirectoryName, 'Installed extension directory not found');

    const extensionRoot = path.join(
      extensionsDirectory,
      installedDirectoryName,
    );
    const { convertToWebp } = require(
      path.join(extensionRoot, 'dist', 'imageConverter.js')
    );
    const finalWebpBuffer = await convertToWebp(tinyPng, { quality: 85 });

    assert.equal(finalWebpBuffer.subarray(0, 4).toString('ascii'), 'RIFF');
    assert.equal(finalWebpBuffer.subarray(8, 12).toString('ascii'), 'WEBP');
    console.log(
      `Verified installed ${installedDirectoryName}: isolated Sharp WASM converted PNG to WebP.`,
    );
  } finally {
    rmSync(testRoot, { recursive: true, force: true });
  }
}

function runCode(arguments_) {
  const result = spawnSync('code', arguments_, {
    encoding: 'utf8',
  });

  if (result.stdout) {
    process.stdout.write(result.stdout);
  }
  if (result.stderr) {
    process.stderr.write(result.stderr);
  }
  if (result.error) {
    throw result.error;
  }

  assert.equal(result.status, 0, 'VS Code CLI failed to install the VSIX');
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
