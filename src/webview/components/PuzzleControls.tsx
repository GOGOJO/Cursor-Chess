import { ChevronRight, Eye, Lightbulb, RotateCcw } from 'lucide-react';
import type { ReactNode } from 'react';

interface PuzzleControlsProps {
  finished: boolean;
  canHint: boolean;
  hintLevel: 0 | 1 | 2;
  canReveal: boolean;
  onHint: () => void;
  onReveal: () => void;
  onReset: () => void;
  onNext: () => void;
}

function ControlButton({
  children,
  onClick,
  disabled,
  primary,
  title,
}: {
  children: ReactNode;
  onClick: () => void;
  disabled?: boolean;
  primary?: boolean;
  title: string;
}) {
  return (
    <button
      type="button"
      title={title}
      onClick={onClick}
      disabled={disabled}
      className={`control-btn ${primary ? 'control-btn-primary' : ''}`}
    >
      {children}
    </button>
  );
}

export function PuzzleControls({ finished, canHint, hintLevel, canReveal, onHint, onReveal, onReset, onNext }: PuzzleControlsProps) {
  const hintTitle = hintLevel === 0 ? 'Highlight the piece to move' : hintLevel === 1 ? 'Show the move' : 'Hint shown';
  return (
    <div className="controls grid grid-cols-4 gap-1">
      <ControlButton title={hintTitle} onClick={onHint} disabled={!canHint || finished}>
        <Lightbulb size={14} />
        <span className="control-label">Hint</span>
      </ControlButton>
      <ControlButton title="Play the solution. This attempt won't count." onClick={onReveal} disabled={!canReveal}>
        <Eye size={14} />
        <span className="control-label">Reveal</span>
      </ControlButton>
      <ControlButton title="Restart this puzzle" onClick={onReset}>
        <RotateCcw size={14} />
        <span className="control-label">Reset</span>
      </ControlButton>
      <ControlButton title="Next puzzle" onClick={onNext} primary={finished}>
        <span className="control-label">Next</span>
        <ChevronRight size={14} />
      </ControlButton>
    </div>
  );
}
