import { Chess } from 'chess.js';
import { describe, expect, it } from 'vitest';
import { SAMPLE_PUZZLES } from '../src/shared/samplePuzzles';
import type { Puzzle } from '../src/shared/types';
import { PuzzleSession, parseUci } from '../src/webview/services/chessService';

const HANGING_PIECE = SAMPLE_PUZZLES.find((p) => p.id === '00008')!;

// Black plays Kh8 as the setup move; both Ra8# and Rb8# mate on the final move.
const BACK_RANK: Puzzle = {
  id: 'test-back-rank',
  fen: '6k1/5ppp/8/8/8/8/5PPP/RR4K1 b - - 0 1',
  moves: ['g8h8', 'a1a8'],
  rating: 600,
  themes: ['backRankMate', 'mateIn1'],
};

// After Kg7 the recorded solution is e8=N+, an underpromotion; e8=Q is legal but not accepted.
const UNDERPROMOTION: Puzzle = {
  id: 'test-underpromotion',
  fen: '6k1/4P3/8/3K4/8/8/8/8 b - - 0 1',
  moves: ['g8g7', 'e7e8n'],
  rating: 900,
  themes: ['promotion'],
};

describe('PuzzleSession setup', () => {
  it('auto-plays the opponent setup move and hands the turn to the player', () => {
    const session = new PuzzleSession(HANGING_PIECE);
    const expected = new Chess(HANGING_PIECE.fen);
    expected.move({ from: 'f2', to: 'g3' });

    expect(session.fen).toBe(expected.fen());
    expect(session.playerColor).toBe('w');
    expect(session.isPlayerTurn).toBe(true);
    expect(session.lastMove).toEqual({ from: 'f2', to: 'g3' });
    expect(session.totalPlayerMoves).toBe(3);
    expect(session.playerMovesMade).toBe(0);
  });

  it('rejects puzzles without a solution move', () => {
    expect(() => new PuzzleSession({ ...BACK_RANK, moves: ['g8h8'] })).toThrow();
  });

  it('rejects malformed UCI', () => {
    expect(() => parseUci('e2e9')).toThrow();
    expect(parseUci('e7e8q')).toEqual({ from: 'e7', to: 'e8', promotion: 'q' });
  });
});

describe('PuzzleSession move validation', () => {
  it('blocks illegal moves without changing the position or counting a mistake', () => {
    const session = new PuzzleSession(HANGING_PIECE);
    const before = session.fen;
    expect(session.submitMove('e6', 'e8').kind).toBe('illegal'); // rook blocked by the e7 rook
    expect(session.submitMove('a2', 'a5').kind).toBe('illegal');
    expect(session.submitMove('a7', 'a6').kind).toBe('illegal'); // opponent's piece
    expect(session.fen).toBe(before);
    expect(session.mistakes).toBe(0);
  });

  it('rejects a legal but wrong move, keeps the position, and allows a retry', () => {
    const session = new PuzzleSession(HANGING_PIECE);
    const before = session.fen;
    const result = session.submitMove('h2', 'g3');
    expect(result).toEqual({ kind: 'wrong', san: 'hxg3' });
    expect(session.fen).toBe(before);
    expect(session.mistakes).toBe(1);
    expect(session.isPlayerTurn).toBe(true);
    expect(session.submitMove('e6', 'e7').kind).toBe('correct');
  });

  it('lists legal targets only for the side to move', () => {
    const session = new PuzzleSession(HANGING_PIECE);
    expect(session.legalTargets('e6')).toContain('e7');
    expect(session.legalTargets('a7')).toEqual([]);
  });
});

describe('PuzzleSession multi-move progression', () => {
  it('walks the full solution with opponent replies and ends solved', () => {
    const session = new PuzzleSession(HANGING_PIECE);

    expect(session.submitMove('e6', 'e7')).toEqual({ kind: 'correct', san: 'Rxe7' });
    expect(session.pendingReply).toBe(true);
    expect(session.submitMove('h6', 'h7').kind).toBe('illegal'); // not the player's turn yet
    expect(session.playOpponentReply()).toBe('Qb1+');
    expect(session.inCheck).toBe(true);
    expect(session.checkedKingSquare).toBe('h1');

    expect(session.submitMove('b3', 'c1')).toEqual({ kind: 'correct', san: 'Nc1' });
    expect(session.playOpponentReply()).toBe('Qxc1+');

    expect(session.submitMove('h6', 'c1')).toEqual({ kind: 'solved', san: 'Qxc1' });
    expect(session.status).toBe('solved');
    expect(session.playerMovesMade).toBe(3);
    expect(session.playOpponentReply()).toBeNull();
    expect(session.submitMove('c1', 'c2').kind).toBe('illegal');
  });

  it('reset restores the post-setup position and clears mistakes', () => {
    const session = new PuzzleSession(HANGING_PIECE);
    const start = session.fen;
    session.submitMove('h2', 'g3');
    session.submitMove('e6', 'e7');
    session.playOpponentReply();
    session.reset();
    expect(session.fen).toBe(start);
    expect(session.mistakes).toBe(0);
    expect(session.status).toBe('playing');
    expect(session.playerMovesMade).toBe(0);
  });

  it('accepts any checkmate on the final move', () => {
    const recorded = new PuzzleSession(BACK_RANK);
    expect(recorded.submitMove('a1', 'a8').kind).toBe('solved');
    expect(recorded.isCheckmate).toBe(true);

    const alternative = new PuzzleSession(BACK_RANK);
    expect(alternative.submitMove('b1', 'b8').kind).toBe('solved');
  });

  it('defaults promotion to the expected piece and rejects the wrong promotion', () => {
    const session = new PuzzleSession(UNDERPROMOTION);
    expect(session.submitMove('e7', 'e8', 'q').kind).toBe('wrong');
    expect(session.submitMove('e7', 'e8').kind).toBe('solved');
  });
});

describe('sample puzzles', () => {
  it.each(SAMPLE_PUZZLES.map((p) => [p.id, p] as const))('%s replays legally to the end', (_id, puzzle) => {
    const session = new PuzzleSession(puzzle);
    for (let ply = 1; ply < puzzle.moves.length; ply += 2) {
      const { from, to, promotion } = parseUci(puzzle.moves[ply]!);
      const result = session.submitMove(from, to, promotion);
      expect(result.kind).not.toBe('illegal');
      expect(result.kind).not.toBe('wrong');
      session.playOpponentReply();
    }
    expect(session.status).toBe('solved');
  });

  it('has unique ids', () => {
    expect(new Set(SAMPLE_PUZZLES.map((p) => p.id)).size).toBe(SAMPLE_PUZZLES.length);
  });
});
