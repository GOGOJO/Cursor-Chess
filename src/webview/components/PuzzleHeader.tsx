import { Trophy } from 'lucide-react';
import type { PlayerSummary, Puzzle } from '../../shared/types';
import { difficultyBand } from '../services/ratingService';
import { displayThemes } from '../services/themes';
import { PixelKnight } from './PixelKnight';

interface PuzzleHeaderProps {
  puzzle: Puzzle;
  summary: PlayerSummary | null;
}

export function PuzzleHeader({ puzzle, summary }: PuzzleHeaderProps) {
  const themes = displayThemes(puzzle.themes);
  return (
    <header className="flex flex-col gap-2.5">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <PixelKnight size={16} className="text-accent" />
          <span className="text-[13px] font-semibold tracking-tight text-ink">Cursor Chess</span>
        </div>
        {summary && (
          <div className="flex items-center gap-1 text-[11px] text-ink-muted" title="Puzzles solved">
            <Trophy size={12} strokeWidth={2} className="text-gold" />
            <span className="tabular-nums">{summary.solvedCount}</span>
          </div>
        )}
      </div>

      <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-[11px]">
        <span className="font-medium text-ink">{difficultyBand(puzzle.rating)}</span>
        <span className="tabular-nums text-ink-muted">{puzzle.rating}</span>
        <span className="text-ink-faint">·</span>
        <span className="text-ink-faint">#{puzzle.id}</span>
        {themes.map((theme) => (
          <span key={theme} className="rounded-sm bg-surface-raised px-1.5 py-px text-[10px] text-ink-muted">
            {theme}
          </span>
        ))}
      </div>
    </header>
  );
}
