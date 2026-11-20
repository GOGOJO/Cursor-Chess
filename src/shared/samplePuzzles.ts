import type { Puzzle } from './types';

/**
 * Puzzles from the Lichess puzzle database (CC0, https://database.lichess.org/#puzzles).
 * The first entry is the default puzzle shown on launch.
 */
export const SAMPLE_PUZZLES: Puzzle[] = [
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
