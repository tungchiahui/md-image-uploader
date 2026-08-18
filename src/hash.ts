import { createHash } from 'node:crypto';

export interface WebpHash {
  fullHash: string;
  hash8: string;
}

export function hashFinalWebp(finalWebpBuffer: Buffer): WebpHash {
  const fullHash = createHash('sha256')
    .update(finalWebpBuffer)
    .digest('hex');

  return {
    fullHash,
    hash8: fullHash.slice(0, 8),
  };
}
