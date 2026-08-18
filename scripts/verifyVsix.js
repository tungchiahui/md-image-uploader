const assert = require('node:assert/strict');
const { existsSync, mkdtempSync, rmSync } = require('node:fs');
const { tmpdir } = require('node:os');
const path = require('node:path');

const AdmZip = require('adm-zip');

const tinyPng = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=',
  'base64',
);

async function main() {
  const artifactArgument = process.argv[2];
  assert.ok(artifactArgument, 'Usage: node scripts/verifyVsix.js <file.vsix>');

  const artifactPath = path.resolve(artifactArgument);
  assert.ok(existsSync(artifactPath), `VSIX not found: ${artifactPath}`);

  const archive = new AdmZip(artifactPath);
  const entryNames = archive.getEntries().map((entry) => entry.entryName);

  requireEntry(entryNames, 'extension.vsixmanifest');
  requireEntry(entryNames, 'extension/package.json');
  requireEntry(entryNames, 'extension/assets/icon.png');
  requireEntry(entryNames, 'extension/dist/extension.js');
  requireEntry(entryNames, 'extension/dist/imageConverter.js');
  requireEntry(entryNames, 'extension/dist/imageConverterWorker.js');
  requireEntry(entryNames, 'extension/node_modules/sharp/package.json');
  requireMatchingEntry(
    entryNames,
    /^extension\/node_modules\/@img\/sharp-wasm32\/lib\/.+\.node\.wasm$/,
    'Sharp WebAssembly backend',
  );
  assert.equal(
    entryNames.some(
      (entryName) =>
        entryName.startsWith(
          'extension/node_modules/@img/sharp-linux-x64/',
        ) ||
        entryName.startsWith(
          'extension/node_modules/@img/sharp-libvips-linux-x64/',
        ),
    ),
    false,
    'VSIX must not contain Electron-incompatible Sharp Linux binaries',
  );
  assert.equal(
    entryNames.some(
      (entryName) =>
        entryName.startsWith('extension/src/') ||
        entryName.startsWith('extension/test/'),
    ),
    false,
    'VSIX must not contain source or test files',
  );

  const manifest = archive.readAsText('extension.vsixmanifest');
  assert.match(
    manifest,
    /<Identity[^>]+Id="md-image-uploader"[^>]+Publisher="tungchiahui"/,
  );
  assert.match(manifest, /TargetPlatform="linux-x64"/);

  const extractionRoot = mkdtempSync(
    path.join(tmpdir(), 'md-image-uploader-vsix-'),
  );

  try {
    archive.extractAllTo(extractionRoot, true);
    const extensionRoot = path.join(extractionRoot, 'extension');
    const { convertToWebp } = require(
      path.join(extensionRoot, 'dist', 'imageConverter.js')
    );
    const finalWebpBuffer = await convertToWebp(tinyPng, { quality: 85 });

    assert.equal(finalWebpBuffer.subarray(0, 4).toString('ascii'), 'RIFF');
    assert.equal(finalWebpBuffer.subarray(8, 12).toString('ascii'), 'WEBP');
    console.log(
      `Verified ${path.basename(artifactPath)}: isolated Sharp WASM converted PNG to WebP.`,
    );
  } finally {
    rmSync(extractionRoot, { recursive: true, force: true });
  }
}

function requireEntry(entryNames, requiredEntry) {
  assert.ok(
    entryNames.includes(requiredEntry),
    `VSIX is missing ${requiredEntry}`,
  );
}

function requireMatchingEntry(entryNames, pattern, description) {
  assert.ok(
    entryNames.some((entryName) => pattern.test(entryName)),
    `VSIX is missing ${description}`,
  );
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
