import { Chess } from 'chess.js';
import type { Puzzle } from '../../shared/types';

export const LICHESS_PUZZLE_DB_URL = 'https://database.lichess.org/lichess_db_puzzle.csv.zst';

/** One row of the Lichess puzzle CSV, with the quality columns kept for filtering. */
export interface LichessRow {
  puzzle: Puzzle;
  ratingDeviation: number;
  popularity: number;
  plays: number;
}

const ID = /^[A-Za-z0-9]{5,8}$/;
const UCI = /^[a-h][1-8][a-h][1-8][qrbn]?$/;

/**
 * Parses `PuzzleId,FEN,Moves,Rating,RatingDeviation,Popularity,NbPlays,Themes,GameUrl,OpeningTags`.
 * Returns null for the header and for malformed rows. Does not replay the moves; see `replaysLegally`.
 */
export function parseLichessRow(line: string): LichessRow | null {
  const cols = line.trim().split(',');
  if (cols.length < 8) return null;
  const [id, fen, moveField, ratingField, deviationField, popularityField, playsField, themeField, gameUrl] = cols;
  if (!id || !ID.test(id) || !fen) return null;

  const moves = moveField!.split(' ').filter(Boolean);
  if (moves.length < 2 || !moves.every((m) => UCI.test(m))) return null;

  const rating = Number(ratingField);
  const ratingDeviation = Number(deviationField);
  const popularity = Number(popularityField);
  const plays = Number(playsField);
  if (![rating, ratingDeviation, popularity, plays].every(Number.isFinite)) return null;
  if (rating < 100 || rating > 3500) return null;

  const puzzle: Puzzle = { id, fen, moves, rating: Math.round(rating), themes: themeField!.split(' ').filter(Boolean) };
  if (gameUrl?.startsWith('https://lichess.org/')) puzzle.gameUrl = gameUrl;
  return { puzzle, ratingDeviation, popularity, plays };
}

/** True when every move of the puzzle is legal from its FEN. */
export function replaysLegally(puzzle: Puzzle): boolean {
  try {
    const chess = new Chess(puzzle.fen);
    for (const uci of puzzle.moves) {
      chess.move({ from: uci.slice(0, 2), to: uci.slice(2, 4), promotion: uci[4] });
    }
    return true;
  } catch {
    return false;
  }
}

export interface ImportOptions {
  /** Ids already in the library; these rows are skipped. */
  existingIds: ReadonlySet<string>;
  /** Stop once this many new puzzles have been accepted. */
  limit: number;
  /** Extra filter, such as the current difficulty and theme. */
  accept?: (puzzle: Puzzle) => boolean;
  isCancelled?: () => boolean;
  onProgress?: (rowsRead: number, added: number) => void;
}

export interface ImportResult {
  puzzles: Puzzle[];
  rowsRead: number;
  stoppedBy: 'limit' | 'end' | 'cancelled';
}

const MAX_RATING_DEVIATION = 120;
const MIN_POPULARITY = 0;
const MIN_PLAYS = 100;
const PROGRESS_EVERY = 5_000;

/**
 * Reads Lichess CSV lines until `limit` new puzzles are found, the input ends, or the
 * caller cancels. Rows with few plays, an unsettled rating, or a negative popularity
 * score are skipped, as is anything that fails to replay.
 */
export async function importLichessRows(lines: AsyncIterable<string>, options: ImportOptions): Promise<ImportResult> {
  const puzzles: Puzzle[] = [];
  const seen = new Set<string>();
  let rowsRead = 0;

  for await (const line of lines) {
    if (options.isCancelled?.()) return { puzzles, rowsRead, stoppedBy: 'cancelled' };
    rowsRead += 1;
    if (rowsRead % PROGRESS_EVERY === 0) options.onProgress?.(rowsRead, puzzles.length);

    const row = parseLichessRow(line);
    if (!row) continue;
    const { puzzle } = row;
    if (options.existingIds.has(puzzle.id) || seen.has(puzzle.id)) continue;
    if (row.ratingDeviation > MAX_RATING_DEVIATION || row.popularity < MIN_POPULARITY || row.plays < MIN_PLAYS) continue;
    if (options.accept && !options.accept(puzzle)) continue;
    if (!replaysLegally(puzzle)) continue;

    seen.add(puzzle.id);
    puzzles.push(puzzle);
    if (puzzles.length >= options.limit) {
      options.onProgress?.(rowsRead, puzzles.length);
      return { puzzles, rowsRead, stoppedBy: 'limit' };
    }
  }

  options.onProgress?.(rowsRead, puzzles.length);
  return { puzzles, rowsRead, stoppedBy: 'end' };
}
