import { ChevronRight, Lightbulb, RotateCcw } from 'lucide-react';
import type { ReactNode } from 'react';

interface PuzzleControlsProps {
  solved: boolean;
  canHint: boolean;
  onHint: () => void;
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

export function PuzzleControls({ solved, canHint, onHint, onReset, onNext }: PuzzleControlsProps) {
  return (
    <div className="grid grid-cols-3 gap-1.5">
      <ControlButton title="Highlight the piece to move" onClick={onHint} disabled={!canHint || solved}>
        <Lightbulb size={14} />
        <span>Hint</span>
      </ControlButton>
      <ControlButton title="Restart this puzzle" onClick={onReset}>
        <RotateCcw size={14} />
        <span>Reset</span>
      </ControlButton>
      <ControlButton title="Next puzzle" onClick={onNext} primary={solved}>
        <span>Next</span>
        <ChevronRight size={14} />
      </ControlButton>
    </div>
  );
}
