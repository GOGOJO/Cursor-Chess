import { Check, CircleDot, Eye, X } from 'lucide-react';
import type { AttemptRecord, AttemptState } from '../../shared/progression';
import type { Feedback } from '../hooks/usePuzzle';
import type { PuzzleSession } from '../services/chessService';

interface PuzzleFeedbackProps {
  session: PuzzleSession;
  feedback: Feedback;
  attempt: AttemptState | null;
  result: AttemptRecord | null;
}

const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? '' : 's'}`;

function solveNote(attempt: AttemptState | null): string {
  if (!attempt || (attempt.mistakes === 0 && attempt.hints === 0)) return 'Clean solve.';
  const parts = [];
  if (attempt.mistakes > 0) parts.push(plural(attempt.mistakes, 'mistake'));
  if (attempt.hints > 0) parts.push(plural(attempt.hints, 'hint'));
  return `Solved with ${parts.join(' and ')}, so it counts as a miss.`;
}

function ResultLine({ result }: { result: AttemptRecord | null }) {
  if (!result) return null;
  const delta = result.ratingAfter - result.ratingBefore;
  return (
    <div className="flex shrink-0 flex-col items-end gap-0.5 text-[11px] tabular-nums">
      <span className={delta >= 0 ? 'font-semibold text-accent' : 'font-semibold text-danger'}>
        {delta >= 0 ? '+' : '−'}
        {Math.abs(delta)}
      </span>
      {result.xp > 0 && <span className="text-gold">+{result.xp} XP</span>}
    </div>
  );
}

function ProgressPips({ session }: { session: PuzzleSession }) {
  return (
    <div className="flex items-center gap-1" aria-label={`${session.playerMovesMade} of ${session.totalPlayerMoves} moves found`}>
      {Array.from({ length: session.totalPlayerMoves }, (_, i) => (
        <span key={i} className={`pip ${i < session.playerMovesMade ? 'bg-accent' : 'bg-surface-raised'}`} />
      ))}
    </div>
  );
}

export function PuzzleFeedback({ session, feedback, attempt, result }: PuzzleFeedbackProps) {
  const side = session.playerColor === 'w' ? 'White' : 'Black';

  if (feedback.kind === 'solved' || feedback.kind === 'failed') {
    const solved = feedback.kind === 'solved';
    const title = solved ? (session.isCheckmate ? 'Checkmate' : session.isStalemate ? 'Stalemate' : 'Puzzle solved') : 'Solution revealed';
    const ending = session.isCheckmate ? 'It ends in checkmate. ' : session.isStalemate ? 'It ends in stalemate. ' : '';
    const detail = solved ? solveNote(attempt) : `${ending}Counts as a miss, with no XP.`;
    return (
      <div
        className={`solved-banner flex items-center gap-3 rounded-md border px-3 py-2.5 ${solved ? 'border-accent/30 bg-accent/10' : 'border-gold/30 bg-gold/10'}`}
        role="status"
      >
        <span
          className={`pixel-badge flex size-7 shrink-0 items-center justify-center text-canvas ${solved ? 'bg-accent' : 'bg-gold'}`}
        >
          {solved ? <Check size={16} strokeWidth={3} /> : <Eye size={15} strokeWidth={2.5} />}
        </span>
        <div className="flex min-w-0 flex-1 flex-col">
          <span className="text-[13px] font-semibold text-ink">{title}</span>
          <span className="text-[11px] text-ink-muted">{detail}</span>
        </div>
        <ResultLine result={result} />
      </div>
    );
  }

  let icon = (
    <span className={`size-2.5 rounded-[2px] ${session.playerColor === 'w' ? 'bg-[#efe9dc]' : 'bg-[#121314] ring-1 ring-ink-faint'}`} />
  );
  let text = session.isPlayerTurn
    ? session.inCheck
      ? `Check. ${side} to move.`
      : `${side} to move. Find the best move.`
    : 'Opponent is replying…';
  let tone = 'text-ink-muted';

  if (feedback.kind === 'wrong') {
    icon = <X size={13} strokeWidth={2.5} className="text-danger" />;
    text = `${feedback.san} isn't it. Try again.`;
    tone = 'text-ink feedback-shake';
  } else if (feedback.kind === 'correct') {
    icon = <CircleDot size={13} strokeWidth={2.5} className="text-accent" />;
    if (session.inCheck && session.isPlayerTurn) text = `Check. ${side} to move.`;
    else if (session.inCheck) text = `${feedback.san}. Check.`;
    else if (session.isPlayerTurn) text = `${feedback.san} is right. Keep going.`;
    else text = `${feedback.san}. Good move.`;
    tone = 'text-ink';
  } else if (feedback.kind === 'revealing') {
    icon = <Eye size={13} strokeWidth={2.5} className="text-gold" />;
    text = session.inCheck ? `Check. ${feedback.san}` : feedback.san;
    tone = 'text-ink';
  }

  return (
    <div className="flex min-h-7 flex-wrap items-center justify-between gap-x-2 gap-y-1">
      <div key={`${feedback.kind}-${session.mistakes}-${session.fen}`} className={`flex items-center gap-2 text-[12px] ${tone}`} role="status">
        {icon}
        <span>{text}</span>
      </div>
      <ProgressPips session={session} />
    </div>
  );
}
