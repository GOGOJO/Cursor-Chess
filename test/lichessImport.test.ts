import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import * as zlib from 'node:zlib';
import { afterAll, describe, expect, it } from 'vitest';
import { importLichessRows, parseLichessRow, replaysLegally } from '../src/extension/providers/lichessCsv';
import { PuzzleCache, type TextFile } from '../src/extension/providers/puzzleCache';
import { LocalPuzzleProvider } from '../src/extension/providers/localPuzzleProvider';
import { openLineSource, supportsZstd } from '../src/extension/providers/puzzleSource';
import { SAMPLE_PUZZLES } from '../src/shared/samplePuzzles';
import type { Puzzle } from '../src/shared/types';

const HEADER = 'PuzzleId,FEN,Moves,Rating,RatingDeviation,Popularity,NbPlays,Themes,GameUrl,OpeningTags';
// Positions and moves from real Lichess puzzles, in the database's column layout.
const ROW_A =
  '00008,r6k/pp2r2p/4Rp1Q/3p4/8/1N1P2R1/PqP2bPP/7K b - - 0 24,f2g3 e6e7 b2b1 b3c1 b1c1 h6c1,1913,76,94,6230,crushing hangingPiece long middlegame,https://lichess.org/787zsVup/black#47,';
const ROW_B =
  '0000D,5rk1/1p3ppp/pq3b2/8/8/1P1Q1N2/P4PPP/3R2K1 w - - 2 27,d3d6 f8d8 d6d8 f6d8,1513,74,96,31097,advantage endgame short,https://lichess.org/F8M8OS71#53,';
const ROW_C =
  '0009B,r2qr1k1/b1p2ppp/pp4n1/P1P1p3/4P1n1/B2P2Pb/3NBP1P/RN1QR1K1 b - - 1 16,b6c5 e2g4 h3g4 d1g4,1112,74,87,569,advantage middlegame short,https://lichess.org/4MWQCxQ6/black#31,Kings_Pawn_Game';
// After Bxg3 the e6 rook can't reach e8: the black rook on e7 is in the way.
const ILLEGAL = 'zzzzz,r6k/pp2r2p/4Rp1Q/3p4/8/1N1P2R1/PqP2bPP/7K b - - 0 24,f2g3 e6e8,1500,76,94,6230,fork,,';
const UNSETTLED = 'yyyyy,5rk1/1p3ppp/pq3b2/8/8/1P1Q1N2/P4PPP/3R2K1 w - - 2 27,d3d6 f8d8 d6d8 f6d8,1513,300,96,31097,fork,,';
const FEW_PLAYS = 'xxxxx,5rk1/1p3ppp/pq3b2/8/8/1P1Q1N2/P4PPP/3R2K1 w - - 2 27,d3d6 f8d8 d6d8 f6d8,1513,70,96,12,fork,,';

async function* linesOf(...lines: string[]): AsyncIterable<string> {
  for (const line of lines) yield line;
}

const tempDir = mkdtempSync(join(tmpdir(), 'cursor-chess-'));
afterAll(() => rmSync(tempDir, { recursive: true, force: true }));

describe('parseLichessRow', () => {
  it('parses a database row and keeps the game link', () => {
    const row = parseLichessRow(ROW_A);
    expect(row?.puzzle).toEqual({
      id: '00008',
      fen: 'r6k/pp2r2p/4Rp1Q/3p4/8/1N1P2R1/PqP2bPP/7K b - - 0 24',
      moves: ['f2g3', 'e6e7', 'b2b1', 'b3c1', 'b1c1', 'h6c1'],
      rating: 1913,
      themes: ['crushing', 'hangingPiece', 'long', 'middlegame'],
      gameUrl: 'https://lichess.org/787zsVup/black#47',
    });
    expect(row).toMatchObject({ ratingDeviation: 76, popularity: 94, plays: 6230 });
  });

  it('rejects the header and malformed rows', () => {
    expect(parseLichessRow(HEADER)).toBeNull();
    expect(parseLichessRow('')).toBeNull();
    expect(parseLichessRow('abcde,fen,e2e4,notanumber,1,1,1,fork')).toBeNull();
    expect(parseLichessRow('abcde,fen,e2e9 e7e5,1500,1,1,1,fork')).toBeNull();
    expect(parseLichessRow('abcde,fen,e2e4,1500,1,1,1,fork')).toBeNull();
  });

  it('checks that the moves replay', () => {
    expect(replaysLegally(parseLichessRow(ROW_A)!.puzzle)).toBe(true);
    expect(replaysLegally(parseLichessRow(ILLEGAL)!.puzzle)).toBe(false);
  });
});

describe('importLichessRows', () => {
  it('keeps good rows and skips duplicates, illegal lines, and low-quality rows', async () => {
    const result = await importLichessRows(linesOf(HEADER, ROW_A, ROW_B, ROW_A, ILLEGAL, UNSETTLED, FEW_PLAYS, ROW_C), {
      existingIds: new Set(['0000D']),
      limit: 10,
    });
    expect(result.puzzles.map((p) => p.id)).toEqual(['00008', '0009B']);
    expect(result).toMatchObject({ rowsRead: 8, stoppedBy: 'end' });
  });

  it('stops at the limit without reading further', async () => {
    const result = await importLichessRows(linesOf(ROW_A, ROW_B, ROW_C), { existingIds: new Set(), limit: 2 });
    expect(result.puzzles.map((p) => p.id)).toEqual(['00008', '0000D']);
    expect(result).toMatchObject({ rowsRead: 2, stoppedBy: 'limit' });
  });

  it('applies an extra filter and honours cancellation', async () => {
    const filtered = await importLichessRows(linesOf(ROW_A, ROW_B, ROW_C), {
      existingIds: new Set(),
      limit: 10,
      accept: (p) => p.rating < 1200,
    });
    expect(filtered.puzzles.map((p) => p.id)).toEqual(['0009B']);

    let reads = 0;
    const cancelled = await importLichessRows(linesOf(ROW_A, ROW_B, ROW_C), {
      existingIds: new Set(),
      limit: 10,
      isCancelled: () => ++reads > 1,
    });
    expect(cancelled).toMatchObject({ stoppedBy: 'cancelled', rowsRead: 1 });
  });
});

describe('openLineSource', () => {
  it('streams a plain CSV file line by line', async () => {
    const path = join(tempDir, 'puzzles.csv');
    writeFileSync(path, [HEADER, ROW_A, ROW_B].join('\n'));
    const source = await openLineSource({ kind: 'file', path });
    const result = await importLichessRows(source.lines, { existingIds: new Set(), limit: 10 });
    source.close();
    expect(result.puzzles.map((p) => p.id)).toEqual(['00008', '0000D']);
  });

  it.runIf(supportsZstd())('decompresses a .csv.zst file', async () => {
    const path = join(tempDir, 'puzzles.csv.zst');
    const compress = (zlib as unknown as { zstdCompressSync: (b: Buffer) => Buffer }).zstdCompressSync;
    writeFileSync(path, compress(Buffer.from([HEADER, ROW_A, ROW_C].join('\n'))));
    const source = await openLineSource({ kind: 'file', path });
    const result = await importLichessRows(source.lines, { existingIds: new Set(), limit: 10 });
    source.close();
    expect(result.puzzles.map((p) => p.id)).toEqual(['00008', '0009B']);
  });

  it.runIf(!supportsZstd())('explains when the runtime cannot read .zst', async () => {
    await expect(openLineSource({ kind: 'file', path: join(tempDir, 'missing.csv.zst') })).rejects.toThrow(/zstd -d/);
  });
});

class MemoryFile implements TextFile {
  text: string | undefined;
  async read() {
    return this.text;
  }
  async write(text: string) {
    this.text = text;
  }
  async delete() {
    this.text = undefined;
  }
}

describe('PuzzleCache and LocalPuzzleProvider', () => {
  const imported = (id: string, rating = 1500): Puzzle => ({ ...parseLichessRow(ROW_B)!.puzzle, id, rating, themes: ['fork'] });

  it('round-trips imported puzzles and survives a corrupt file', async () => {
    const file = new MemoryFile();
    const cache = new PuzzleCache(file);
    await cache.save([imported('aaaaa'), imported('bbbbb')]);
    expect((await cache.load()).map((p) => p.id)).toEqual(['aaaaa', 'bbbbb']);

    file.text = '{not json';
    expect(await cache.load()).toEqual([]);
    file.text = JSON.stringify({ version: 1, puzzles: [{ id: 'bad' }, imported('ccccc')] });
    expect((await cache.load()).map((p) => p.id)).toEqual(['ccccc']);
  });

  it('keeps only the newest puzzles past the cap', async () => {
    const cache = new PuzzleCache(new MemoryFile(), 2);
    const kept = await cache.save([imported('aaaaa'), imported('bbbbb'), imported('ccccc')]);
    expect(kept.map((p) => p.id)).toEqual(['bbbbb', 'ccccc']);
  });

  it('adds imports to the library, reloads them after a restart, and clears them', async () => {
    const file = new MemoryFile();
    const provider = new LocalPuzzleProvider(new PuzzleCache(file));
    await provider.load();
    expect(provider.count()).toBe(SAMPLE_PUZZLES.length);
    expect(provider.knownIds().has(SAMPLE_PUZZLES[0]!.id)).toBe(true);

    await provider.addImported([imported('aaaaa', 2600)]);
    expect(provider.importedCount).toBe(1);
    expect(provider.count({ difficulty: 'Expert', theme: 'fork' })).toBeGreaterThan(0);

    const restarted = new LocalPuzzleProvider(new PuzzleCache(file));
    await restarted.load();
    expect(restarted.has('aaaaa')).toBe(true);

    await restarted.clearImported();
    expect(restarted.importedCount).toBe(0);
    expect(file.text).toBeUndefined();
  });
});
