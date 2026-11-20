import { createReadStream } from 'node:fs';
import { createInterface } from 'node:readline';
import { Readable } from 'node:stream';
import type { ReadableStream as WebReadableStream } from 'node:stream/web';
import * as zlib from 'node:zlib';

export type PuzzleSourceLocation = { kind: 'file'; path: string } | { kind: 'url'; url: string };

export interface LineSource {
  lines: AsyncIterable<string>;
  /** Stops reading and releases the file or network connection. Safe to call twice. */
  close(): void;
}

function isZstd(name: string): boolean {
  return /\.zst$/i.test(name.split('?')[0]!);
}

/** zstd landed in Node 22.15 and 23.8; older editor runtimes lack it. */
export function supportsZstd(): boolean {
  return typeof (zlib as { createZstdDecompress?: unknown }).createZstdDecompress === 'function';
}

/**
 * Opens a Lichess puzzle CSV as a stream of lines, decompressing `.zst` on the fly.
 * Nothing is buffered beyond what readline holds, so huge files are fine.
 */
export async function openLineSource(location: PuzzleSourceLocation): Promise<LineSource> {
  const target = location.kind === 'file' ? location.path : location.url;
  if (isZstd(target) && !supportsZstd()) {
    throw new Error(
      "this editor's Node runtime can't read .zst files. Decompress it with `zstd -d` and import the .csv instead.",
    );
  }
  const abort = new AbortController();
  let raw: Readable;
  let name: string;

  if (location.kind === 'file') {
    raw = createReadStream(location.path);
    name = location.path;
  } else {
    const response = await fetch(location.url, { signal: abort.signal });
    if (!response.ok || !response.body) {
      throw new Error(`Download failed (${response.status} ${response.statusText})`);
    }
    raw = Readable.fromWeb(response.body as WebReadableStream<Uint8Array>);
    name = location.url;
  }

  const input = isZstd(name) ? raw.pipe(zlib.createZstdDecompress()) : raw;
  raw.on('error', (error) => input.destroy(error));
  const reader = createInterface({ input, crlfDelay: Infinity });

  let closed = false;
  return {
    lines: reader,
    close() {
      if (closed) return;
      closed = true;
      reader.close();
      abort.abort();
      raw.destroy();
      if (input !== raw) input.destroy();
    },
  };
}
