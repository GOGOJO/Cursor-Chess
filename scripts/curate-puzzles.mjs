/**
 * Builds src/shared/samplePuzzles.ts from the Lichess puzzle database (CC0).
 *
 *   curl -fsSL https://database.lichess.org/lichess_db_puzzle.csv.zst \
 *     | zstd -dc | node scripts/curate-puzzles.mjs
 *
 * Reads only as far as it needs to fill each theme pool, then stops.
 */
import { createRequire } from 'node:module';
import { createInterface } from 'node:readline';
import { writeFileSync } from 'node:fs';

const require = createRequire(import.meta.url);
const { Chess } = require('chess.js');

const TARGETS = {
  mateIn1: 28,
  mateIn2: 24,
  fork: 20,
  pin: 20,
  skewer: 14,
  discoveredAttack: 14,
  doubleCheck: 12,
  deflection: 14,
  backRankMate: 14,
  hangingPiece: 18,
  promotion: 18,
  underPromotion: 10,
  sacrifice: 12,
  trappedPiece: 12,
  attraction: 12,
};

const THEME_ORDER = Object.keys(TARGETS);
const MAX_LINES = 700_000;
const POOL_LIMIT = 90;
const OUT = new URL('../src/shared/samplePuzzles.ts', import.meta.url);

/** The phase-1 puzzles stay first so the sidebar still opens on the same position. */
const PINNED = [
  {
    id: '00008',
    fen: 'r6k/pp2r2p/4Rp1Q/3p4/8/1N1P2R1/PqP2bPP/7K b - - 0 24',
    moves: ['f2g3', 'e6e7', 'b2b1', 'b3c1', 'b1c1', 'h6c1'],
    rating: 1913,
    themes: ['crushing', 'hangingPiece', 'long', 'middlegame'],
  },
  {
    id: '0000D',
    fen: '5rk1/1p3ppp/pq3b2/8/8/1P1Q1N2/P4PPP/3R2K1 w - - 2 27',
    moves: ['d3d6', 'f8d8', 'd6d8', 'f6d8'],
    rating: 1513,
    themes: ['advantage', 'endgame', 'short'],
  },
  {
    id: '0009B',
    fen: 'r2qr1k1/b1p2ppp/pp4n1/P1P1p3/4P1n1/B2P2Pb/3NBP1P/RN1QR1K1 b - - 1 16',
    moves: ['b6c5', 'e2g4', 'h3g4', 'd1g4'],
    rating: 1112,
    themes: ['advantage', 'middlegame', 'short'],
  },
  {
    id: '000aY',
    fen: 'r4rk1/pp3ppp/2n1b3/q1pp2B1/8/P1Q2NP1/1PP1PP1P/2KR3R w - - 0 15',
    moves: ['g5e7', 'a5c3', 'b2c3', 'c6e7'],
    rating: 1468,
    themes: ['advantage', 'master', 'middlegame', 'short'],
  },
];

const pinnedIds = new Set(PINNED.map((p) => p.id));
const pools = Object.fromEntries(THEME_ORDER.map((theme) => [theme, []]));

function playerMoves(moves) {
  const result = [];
  for (let i = 1; i < moves.length; i += 2) result.push(moves[i]);
  return result;
}

function isPromotion(uci) {
  return /^[a-h][1-8][a-h][18][qrbn]$/.test(uci);
}

function isUnderPromotion(uci) {
  return /^[a-h][1-8][a-h][18][nbr]$/.test(uci);
}

function replays(fen, moves) {
  try {
    const chess = new Chess(fen);
    for (const uci of moves) {
      const move = chess.move({
        from: uci.slice(0, 2),
        to: uci.slice(2, 4),
        promotion: uci[4],
      });
      if (!move) return false;
    }
    return true;
  } catch {
    return false;
  }
}

function bucketsFor(themes, moves) {
  const players = playerMoves(moves);
  const found = [];
  for (const theme of THEME_ORDER) {
    if (theme === 'promotion') {
      if (themes.includes('promotion') && players.some(isPromotion)) found.push(theme);
    } else if (theme === 'underPromotion') {
      if (themes.includes('underPromotion') || players.some(isUnderPromotion)) found.push(theme);
    } else if (themes.includes(theme)) {
      found.push(theme);
    }
  }
  return found;
}

function poolsAreFull() {
  return THEME_ORDER.every((theme) => pools[theme].length >= Math.min(POOL_LIMIT, TARGETS[theme] * 3));
}

function consider(line) {
  const parts = line.split(',');
  if (parts.length < 9) return;
  const [id, fen, moveField, ratingField, deviationField, popularityField, playsField, themeField] = parts;
  if (!id || id === 'PuzzleId' || pinnedIds.has(id)) return;

  const rating = Number(ratingField);
  const deviation = Number(deviationField);
  const popularity = Number(popularityField);
  const plays = Number(playsField);
  if (rating < 500 || rating > 2400) return;
  if (deviation > 130) return;
  if (popularity < 40) return;
  if (plays < 400) return;

  const moves = moveField.split(' ').filter(Boolean);
  if (moves.length < 2 || moves.length > 8 || moves.length % 2 !== 0) return;

  const themes = themeField.split(' ').filter(Boolean);
  const buckets = bucketsFor(themes, moves).filter((theme) => pools[theme].length < POOL_LIMIT);
  if (buckets.length === 0) return;
  if (!replays(fen, moves)) return;

  const puzzle = { id, fen, moves, rating, themes, popularity };
  for (const theme of buckets) pools[theme].push(puzzle);
}

function band(rating) {
  if (rating < 800) return 0;
  if (rating < 1200) return 1;
  if (rating < 1600) return 2;
  if (rating < 2000) return 3;
  return 4;
}

function pick() {
  const used = new Set(pinnedIds);
  const chosen = [];
  const rarestFirst = [...THEME_ORDER].sort((a, b) => pools[a].length - pools[b].length);

  for (const theme of rarestFirst) {
    const counts = [0, 0, 0, 0, 0];
    const candidates = pools[theme]
      .filter((puzzle) => !used.has(puzzle.id))
      .sort((a, b) => b.popularity - a.popularity || a.id.localeCompare(b.id));
    let taken = 0;
    while (taken < TARGETS[theme] && candidates.length > 0) {
      let bestIndex = 0;
      for (let i = 1; i < candidates.length; i++) {
        const best = candidates[bestIndex];
        const next = candidates[i];
        const bestCount = counts[band(best.rating)];
        const nextCount = counts[band(next.rating)];
        if (nextCount < bestCount || (nextCount === bestCount && next.popularity > best.popularity)) bestIndex = i;
      }
      const puzzle = candidates.splice(bestIndex, 1)[0];
      used.add(puzzle.id);
      counts[band(puzzle.rating)] += 1;
      chosen.push(puzzle);
      taken += 1;
    }
    if (taken < TARGETS[theme]) {
      console.error(`short ${theme}: wanted ${TARGETS[theme]}, got ${taken} (pool ${pools[theme].length})`);
    }
  }
  return chosen;
}

function emit(puzzles) {
  const body = puzzles
    .map((puzzle) => {
      const themes = JSON.stringify(puzzle.themes);
      const moves = JSON.stringify(puzzle.moves);
      return `  { id: ${JSON.stringify(puzzle.id)}, fen: ${JSON.stringify(puzzle.fen)}, moves: ${moves}, rating: ${puzzle.rating}, themes: ${themes} },`;
    })
    .join('\n');
  const source = `import type { Puzzle } from './types';

/**
 * Curated slice of the Lichess puzzle database (CC0, https://database.lichess.org/#puzzles).
 * The first puzzle is the one shown on launch. Regenerate with scripts/curate-puzzles.mjs.
 */
export const SAMPLE_PUZZLES: Puzzle[] = [
${body}
];
`;
  writeFileSync(OUT, source);
}

const rl = createInterface({ input: process.stdin, crlfDelay: Infinity });
let lines = 0;

for await (const line of rl) {
  lines += 1;
  if (line) consider(line);
  if (lines % 50_000 === 0) {
    const sizes = THEME_ORDER.map((theme) => `${theme}:${pools[theme].length}`).join(' ');
    console.error(`read ${lines} ${sizes}`);
  }
  if (lines >= MAX_LINES || poolsAreFull()) break;
}

rl.close();
process.stdin.destroy();

const selected = pick();
const promotion = selected.find((puzzle) => playerMoves(puzzle.moves).some(isPromotion));
const rest = selected
  .filter((puzzle) => puzzle !== promotion)
  .sort((a, b) => a.id.localeCompare(b.id));
const ordered = promotion ? [PINNED[0], promotion, ...PINNED.slice(1), ...rest] : [...PINNED, ...rest];

emit(ordered);
console.error(`wrote ${ordered.length} puzzles from ${lines} lines`);
