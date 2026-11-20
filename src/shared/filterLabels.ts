import { themeLabel } from './themes';
import type { PuzzleFilters } from './types';

/** "Expert fork", "Expert", "fork", or "any" style label for messages. */
export function describeFilters(filters: PuzzleFilters): string {
  const parts: string[] = [];
  if (filters.difficulty !== 'any') parts.push(filters.difficulty);
  if (filters.theme !== 'any') parts.push(parts.length ? themeLabel(filters.theme).toLowerCase() : themeLabel(filters.theme));
  return parts.join(' ');
}

export function noMatchNotice(filters: PuzzleFilters): string {
  return `No ${describeFilters(filters)} puzzles yet, so here's one from the whole library. Import more from Lichess to fill this in.`;
}
