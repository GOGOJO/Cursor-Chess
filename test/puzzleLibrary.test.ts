import { describe, expect, it } from 'vitest';
import { difficultyBand } from '../src/shared/difficulty';
import { chooseNextPuzzle, matchesFilters, PuzzleLibrary } from '../src/shared/puzzleLibrary';
import { SAMPLE_PUZZLES } from '../src/shared/samplePuzzles';
import { DEFAULT_FILTERS, type Puzzle } from '../src/shared/types';

function puzzle(id: string, rating: number, themes: string[]): Puzzle {
  return { id, fen: '8/8/8/8/8/8/8/8 w - - 0 1', moves: ['a1a2', 'a2a3'], rating, themes };
}

const EASY_FORK = puzzle('ef', 1000, ['fork', 'short']);
const EASY_PIN = puzzle('ep', 1100, ['pin']);
const EXPERT_FORK = puzzle('xf', 2200, ['fork']);
const SAMPLE = [EASY_FORK, EASY_PIN, EXPERT_FORK];

describe('matchesFilters', () => {
  it('filters by difficulty band and theme together', () => {
    expect(matchesFilters(EASY_FORK, DEFAULT_FILTERS)).toBe(true);
    expect(matchesFilters(EASY_FORK, { difficulty: 'Easy', theme: 'fork' })).toBe(true);
    expect(matchesFilters(EASY_FORK, { difficulty: 'Expert', theme: 'fork' })).toBe(false);
    expect(matchesFilters(EASY_FORK, { difficulty: 'any', theme: 'pin' })).toBe(false);
  });
});

describe('PuzzleLibrary', () => {
  it('counts and filters the combined pool, dropping imported duplicates of bundled puzzles', () => {
    const imported = puzzle('im', 700, ['mateIn1']);
    const library = new PuzzleLibrary(SAMPLE, [imported, { ...EASY_FORK }]);
    expect(library.totalCount).toBe(4);
    expect(library.importedCount).toBe(1);
    expect(library.matching({ difficulty: 'any', theme: 'fork' }).map((p) => p.id)).toEqual(['ef', 'xf']);
    expect(library.matching({ difficulty: 'Beginner', theme: 'any' }).map((p) => p.id)).toEqual(['im']);
  });

  it('picks a match that was not shown recently', () => {
    const library = new PuzzleLibrary(SAMPLE);
    const fork = { difficulty: 'any' as const, theme: 'fork' };
    expect(library.pick(fork, ['ef'], () => 0)?.id).toBe('xf');
    expect(library.pick(fork, ['xf'], () => 0.99)?.id).toBe('ef');
  });

  it('falls back to the match seen longest ago when every match is recent', () => {
    const library = new PuzzleLibrary(SAMPLE);
    const fork = { difficulty: 'any' as const, theme: 'fork' };
    expect(library.pick(fork, ['xf', 'ep', 'ef'])?.id).toBe('xf');
    expect(library.pick(fork, ['ef', 'xf'])?.id).toBe('ef');
  });

  it('returns null when nothing matches', () => {
    expect(new PuzzleLibrary(SAMPLE).pick({ difficulty: 'Beginner', theme: 'skewer' }, [])).toBeNull();
  });
});

describe('chooseNextPuzzle', () => {
  it('starts a first-time player on the first bundled puzzle', () => {
    const library = new PuzzleLibrary(SAMPLE);
    expect(chooseNextPuzzle(library, DEFAULT_FILTERS, [])).toEqual({ puzzle: EASY_FORK });
  });

  it('respects filters even for a first-time player', () => {
    const library = new PuzzleLibrary(SAMPLE);
    expect(chooseNextPuzzle(library, { difficulty: 'Expert', theme: 'any' }, []).puzzle.id).toBe('xf');
  });

  it('falls back to the whole library with a notice when nothing matches', () => {
    const library = new PuzzleLibrary(SAMPLE);
    const next = chooseNextPuzzle(library, { difficulty: 'Expert', theme: 'pin' }, ['ef']);
    expect(['ep', 'xf']).toContain(next.puzzle.id);
    expect(next.notice).toContain('Expert pin');
  });
});

describe('bundled sample coverage', () => {
  it('has puzzles for every filter theme', () => {
    const library = new PuzzleLibrary(SAMPLE_PUZZLES);
    for (const theme of ['fork', 'pin', 'skewer', 'discoveredAttack', 'doubleCheck', 'deflection', 'backRankMate', 'hangingPiece', 'mateIn1', 'mateIn2']) {
      expect(library.matching({ difficulty: 'any', theme }).length, theme).toBeGreaterThan(0);
    }
  });

  it('has puzzles in every difficulty band', () => {
    const bands = new Set(SAMPLE_PUZZLES.map((p) => difficultyBand(p.rating)));
    expect([...bands].sort()).toEqual(['Advanced', 'Beginner', 'Easy', 'Expert', 'Intermediate']);
  });
});
