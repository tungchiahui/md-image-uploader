import Module from 'node:module';

import type sharpFactory from 'sharp';

import {
  UnsupportedImageFormatError,
  isSupportedImageMimeType,
} from './imageConverter';

interface NodeModuleLoader {
  _load(
    request: string,
    parent: NodeModule | undefined,
    isMain: boolean,
  ): unknown;
}

interface WorkerErrorPayload {
  type: 'unsupported' | 'conversion';
  message: string;
  mediaType?: string;
}

async function main(): Promise<void> {
  const quality = Number(process.argv[2]);
  const inputBuffer = await readStdin();
  const sharp = await loadSharpWithWasmBackend();

  if (!('emscripten' in sharp.versions)) {
    throw new Error('Sharp WebAssembly backend did not load');
  }

  const inputMetadata = await sharp(inputBuffer, { animated: true }).metadata();

  if (
    inputMetadata.mediaType === undefined ||
    !isSupportedImageMimeType(inputMetadata.mediaType)
  ) {
    throw new UnsupportedImageFormatError(inputMetadata.mediaType);
  }

  const outputBuffer = await sharp(inputBuffer, { animated: true })
    .rotate()
    .webp({ quality })
    .toBuffer();

  await writeBuffer(process.stdout, outputBuffer);
}

async function loadSharpWithWasmBackend(): Promise<typeof sharpFactory> {
  const moduleLoader = Module as unknown as NodeModuleLoader;
  const originalLoad = moduleLoader._load;

  moduleLoader._load = function loadWithoutLinuxNativeSharp(
    request: string,
    parent: NodeModule | undefined,
    isMain: boolean,
  ): unknown {
    if (request === '@img/sharp-linux-x64/sharp.node') {
      const error = new Error('Linux native Sharp is disabled in Electron');
      Object.assign(error, { code: 'MODULE_NOT_FOUND' });
      throw error;
    }

    return originalLoad.call(this, request, parent, isMain);
  };

  try {
    return (await import('sharp')).default;
  } finally {
    moduleLoader._load = originalLoad;
  }
}

async function readStdin(): Promise<Buffer> {
  const chunks: Buffer[] = [];

  for await (const chunk of process.stdin) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  }

  return Buffer.concat(chunks);
}

function writeBuffer(stream: NodeJS.WritableStream, buffer: Buffer): Promise<void> {
  return new Promise((resolve, reject) => {
    stream.write(buffer, (error) => {
      if (error === null || error === undefined) {
        resolve();
      } else {
        reject(error);
      }
    });
  });
}

function serializeError(error: unknown): WorkerErrorPayload {
  if (error instanceof UnsupportedImageFormatError) {
    return {
      type: 'unsupported',
      message: error.message,
      ...(error.mediaType === undefined
        ? {}
        : { mediaType: error.mediaType }),
    };
  }

  return {
    type: 'conversion',
    message: error instanceof Error ? error.message : String(error),
  };
}

void main().catch(async (error: unknown) => {
  await writeBuffer(
    process.stderr,
    Buffer.from(JSON.stringify(serializeError(error)), 'utf8'),
  );
  process.exitCode = 1;
});
