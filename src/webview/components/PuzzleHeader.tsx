import { ChartNoAxesColumn, Settings, Volume2, VolumeX } from 'lucide-react';
import type { ProgressSnapshot } from '../../shared/progression';
import type { Puzzle } from '../../shared/types';
import { displayThemes } from '../../shared/themes';
import { difficultyBand } from '../services/ratingService';
import { PixelKnight } from './PixelKnight';

interface AppBarProps {
  progress: ProgressSnapshot | null;
  view: 'puzzle' | 'progress' | 'settings';
  onToggleProgress: () => void;
  onToggleSettings: () => void;
  soundOn: boolean;
  onToggleSound: () => void;
}

export function AppBar({ progress, view, onToggleProgress, onToggleSettings, soundOn, onToggleSound }: AppBarProps) {
  return (
    <div className="flex items-center justify-between">
      <div className="flex items-center gap-2">
        <PixelKnight size={16} className="text-accent" />
        <span className="text-[13px] font-semibold tracking-tight text-ink">Cursor Chess</span>
      </div>
      <div className="flex items-center gap-1.5">
        <button
          type="button"
          className="sound-toggle"
            title={soundOn ? 'Turn sound off' : 'Turn sound on'}
            aria-label={soundOn ? 'Turn sound off' : 'Turn sound on'}
            aria-pressed={soundOn}
          onClick={onToggleSound}
        >
          {soundOn ? <Volume2 size={13} /> : <VolumeX size={13} />}
        </button>
        <button
          type="button"
          className="sound-toggle"
          title={view === 'settings' ? 'Back to the puzzle' : 'Settings'}
          aria-label={view === 'settings' ? 'Back to the puzzle' : 'Settings'}
          aria-pressed={view === 'settings'}
          onClick={onToggleSettings}
        >
          <Settings size={13} />
        </button>
        {progress && (
          <button
            type="button"
            className="rating-chip"
            title={view === 'progress' ? 'Back to the puzzle' : 'Your rating. Open progress.'}
            aria-label={view === 'progress' ? 'Back to the puzzle' : `Rating ${progress.rating}. Open progress.`}
            aria-pressed={view === 'progress'}
            onClick={onToggleProgress}
          >
            <ChartNoAxesColumn size={12} strokeWidth={2.25} className="text-gold" />
            <span className="tabular-nums">{progress.rating}</span>
          </button>
        )}
      </div>
    </div>
  );
}

export function PuzzleHeader({ puzzle }: { puzzle: Puzzle }) {
  const themes = displayThemes(puzzle.themes);
  return (
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
  );
}
