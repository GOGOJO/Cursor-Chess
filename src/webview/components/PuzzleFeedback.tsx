import { Check, CircleDot, X } from 'lucide-react';
import type { Feedback } from '../hooks/usePuzzle';
import type { PuzzleSession } from '../services/chessService';

interface PuzzleFeedbackProps {
  session: PuzzleSession;
  feedback: Feedback;
}

function ProgressPips({ session }: { session: PuzzleSession }) {
  return (
    <div className="flex items-center gap-1" aria-label={`${session.playerMovesMade} of ${session.totalPlayerMoves} moves found`}>
      {Array.from({ length: session.totalPlayerMoves }, (_, i) => (
        <span
          key={i}
          className={`pip ${i < session.playerMovesMade ? 'bg-accent' : 'bg-surface-raised'}`}
        />
      ))}
    </div>
  );
}

export function PuzzleFeedback({ session, feedback }: PuzzleFeedbackProps) {
  const side = session.playerColor === 'w' ? 'White' : 'Black';

  if (feedback.kind === 'solved') {
    const mistakes = session.mistakes;
    return (
      <div className="solved-banner flex items-center gap-3 rounded-md border border-accent/30 bg-accent/10 px-3 py-2.5">
        <span className="pixel-badge flex size-7 shrink-0 items-center justify-center bg-accent text-canvas">
          <Check size={16} strokeWidth={3} />
        </span>
        <div className="flex min-w-0 flex-col">
          <span className="text-[13px] font-semibold text-ink">Puzzle solved</span>
          <span className="text-[11px] text-ink-muted">
            {session.isCheckmate ? 'Checkmate. ' : ''}
            {mistakes === 0 ? 'Clean solve, no mistakes.' : `${mistakes} ${mistakes === 1 ? 'mistake' : 'mistakes'} along the way.`}
          </span>
        </div>
      </div>
    );
  }

  let icon = (
    <span className={`size-2.5 rounded-[2px] ${session.playerColor === 'w' ? 'bg-[#efe9dc]' : 'bg-[#121314] ring-1 ring-ink-faint'}`} />
  );
  let text = session.isPlayerTurn ? `${side} to move. Find the best move.` : 'Opponent is replying…';
  let tone = 'text-ink-muted';

  if (feedback.kind === 'wrong') {
    icon = <X size={13} strokeWidth={2.5} className="text-danger" />;
    text = `${feedback.san} isn't it. Try again.`;
    tone = 'text-ink feedback-shake';
  } else if (feedback.kind === 'correct') {
    icon = <CircleDot size={13} strokeWidth={2.5} className="text-accent" />;
    text = session.isPlayerTurn ? `${feedback.san} is right. Keep going.` : `${feedback.san}. Good move.`;
    tone = 'text-ink';
  }

  return (
    <div className="flex min-h-7 items-center justify-between gap-2">
      <div key={`${feedback.kind}-${session.mistakes}`} className={`flex items-center gap-2 text-[12px] ${tone}`}>
        {icon}
        <span>{text}</span>
      </div>
      <ProgressPips session={session} />
    </div>
  );
}
