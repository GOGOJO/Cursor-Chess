import type { PieceSymbol } from 'chess.js';
import { useEffect, useRef } from 'react';
import { defaultPieces } from 'react-chessboard';

const CHOICES: { piece: PieceSymbol; label: string }[] = [
  { piece: 'q', label: 'Queen' },
  { piece: 'r', label: 'Rook' },
  { piece: 'b', label: 'Bishop' },
  { piece: 'n', label: 'Knight' },
];

interface PromotionPickerProps {
  color: 'w' | 'b';
  onPick: (piece: PieceSymbol) => void;
  onCancel: () => void;
}

export function PromotionPicker({ color, onPick, onCancel }: PromotionPickerProps) {
  const firstButton = useRef<HTMLButtonElement>(null);
  const tile = color === 'w' ? '#7d8f68' : '#e3d9c3';

  useEffect(() => {
    firstButton.current?.focus();
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onCancel();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onCancel]);

  return (
    <div className="promotion-overlay" role="dialog" aria-label="Promote pawn">
      <div className="promotion-sheet">
        <span className="text-[11px] text-ink-muted">Promote to</span>
        <div className="promotion-choices">
          {CHOICES.map(({ piece, label }, index) => {
            const draw = defaultPieces[`${color}${piece.toUpperCase()}`];
            return (
              <button
                key={piece}
                ref={index === 0 ? firstButton : undefined}
                type="button"
                className="promotion-choice"
                style={{ backgroundColor: tile }}
                aria-label={label}
                onClick={() => onPick(piece)}
              >
                {draw?.({ svgStyle: { width: '100%', height: '100%' } })}
              </button>
            );
          })}
        </div>
        <button type="button" className="promotion-cancel" onClick={onCancel}>
          Cancel
        </button>
      </div>
    </div>
  );
}
