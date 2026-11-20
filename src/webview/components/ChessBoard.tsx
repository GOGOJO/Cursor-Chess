import type { PieceSymbol, Square } from 'chess.js';
import type { CSSProperties } from 'react';
import { Chessboard, defaultArrowOptions } from 'react-chessboard';
import type { HintMove, PuzzleSession } from '../services/chessService';
import { PromotionPicker } from './PromotionPicker';

interface ChessBoardProps {
  session: PuzzleSession;
  selected: Square | null;
  wrongSquare: Square | null;
  hintSquare: Square | null;
  hintArrow: HintMove | null;
  revealing: boolean;
  promotion: boolean;
  onMove: (from: Square, to: Square) => boolean;
  onSquareClick: (square: Square) => void;
  onPieceDragStart: (square: Square) => void;
  onDragCancel: () => void;
  onPromote: (piece: PieceSymbol) => void;
  onCancelPromotion: () => void;
}

const COLORS = {
  light: '#e3d9c3',
  dark: '#7d8f68',
  lastMove: 'rgba(214, 186, 92, 0.42)',
  selected: 'rgba(143, 181, 115, 0.55)',
  wrong: 'rgba(205, 96, 80, 0.55)',
  dot: 'rgba(24, 25, 27, 0.28)',
  hint: '#a7cf8a',
  hintArrow: '#e2c56b',
};

function buildSquareStyles({
  session,
  selected,
  wrongSquare,
  hintSquare,
}: Pick<ChessBoardProps, 'session' | 'selected' | 'wrongSquare' | 'hintSquare'>): Record<string, CSSProperties> {
  const styles: Record<string, CSSProperties> = {};
  const merge = (square: string, style: CSSProperties) => {
    styles[square] = { ...styles[square], ...style };
  };

  const last = session.lastMove;
  if (last) {
    merge(last.from, { backgroundColor: COLORS.lastMove });
    merge(last.to, { backgroundColor: COLORS.lastMove });
  }

  const checked = session.checkedKingSquare;
  if (checked) {
    merge(checked, {
      backgroundImage:
        'radial-gradient(circle, rgba(232, 92, 70, 0.95) 0%, rgba(214, 72, 56, 0.55) 38%, rgba(214, 72, 56, 0) 72%)',
    });
  }

  if (hintSquare) {
    merge(hintSquare, { boxShadow: `inset 0 0 0 3px ${COLORS.hint}`, backgroundColor: 'rgba(167, 207, 138, 0.35)' });
  }

  if (selected) {
    merge(selected, { backgroundColor: COLORS.selected });
    for (const target of session.legalTargets(selected)) {
      merge(target, {
        backgroundImage: session.isCapture(selected, target)
          ? `radial-gradient(circle, transparent 58%, ${COLORS.dot} 60%, ${COLORS.dot} 72%, transparent 74%)`
          : `radial-gradient(circle, ${COLORS.dot} 0%, ${COLORS.dot} 17%, transparent 19%)`,
        cursor: 'pointer',
      });
    }
  }

  if (wrongSquare) merge(wrongSquare, { backgroundColor: COLORS.wrong });

  return styles;
}

export function ChessBoard(props: ChessBoardProps) {
  const { session, hintArrow, revealing, promotion, onMove, onSquareClick, onPieceDragStart, onDragCancel, onPromote, onCancelPromotion } = props;
  const orientation = session.playerColor === 'w' ? 'white' : 'black';
  const playerPrefix = session.playerColor;

  return (
    <div className="board-frame">
      <Chessboard
        options={{
          id: 'cursor-chess-board',
          position: session.fen,
          boardOrientation: orientation,
          squareStyles: buildSquareStyles(props),
          arrows: hintArrow
            ? [{ startSquare: hintArrow.from, endSquare: hintArrow.to, color: COLORS.hintArrow }]
            : [],
          arrowOptions: hintArrow ? { ...defaultArrowOptions, opacity: 1, arrowWidthDenominator: 4, arrowStartOffset: 0.32 } : undefined,
          lightSquareStyle: { backgroundColor: COLORS.light },
          darkSquareStyle: { backgroundColor: COLORS.dark },
          lightSquareNotationStyle: { color: COLORS.dark },
          darkSquareNotationStyle: { color: COLORS.light },
          alphaNotationStyle: { fontSize: '9px', fontWeight: 600, bottom: 1, right: 3, position: 'absolute' },
          numericNotationStyle: { fontSize: '9px', fontWeight: 600, top: 2, left: 3, position: 'absolute' },
          dropSquareStyle: { boxShadow: 'inset 0 0 0 3px rgba(255, 248, 230, 0.55)' },
          boardStyle: { borderRadius: '6px' },
          animationDurationInMs: revealing ? 360 : 180,
          allowDrawingArrows: !promotion,
          allowDragOffBoard: false,
          canDragPiece: ({ piece }) => !promotion && session.isPlayerTurn && piece.pieceType.startsWith(playerPrefix),
          onPieceDrag: ({ square }) => {
            if (square) onPieceDragStart(square as Square);
          },
          onPieceDragCancel: onDragCancel,
          onPieceDrop: ({ sourceSquare, targetSquare }) => {
            if (!targetSquare || sourceSquare === targetSquare) return false;
            return onMove(sourceSquare as Square, targetSquare as Square);
          },
          onSquareClick: ({ square }) => onSquareClick(square as Square),
        }}
      />
      {promotion && <PromotionPicker color={session.playerColor} onPick={onPromote} onCancel={onCancelPromotion} />}
    </div>
  );
}
