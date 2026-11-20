import { Info } from 'lucide-react';
import { useEffect, useState } from 'react';
import { BOARD_THEMES } from '../shared/settings';
import { ChessBoard } from './components/ChessBoard';
import { PixelKnight } from './components/PixelKnight';
import { ProgressPanel } from './components/ProgressPanel';
import { PuzzleControls } from './components/PuzzleControls';
import { PuzzleFeedback } from './components/PuzzleFeedback';
import { PuzzleFilters } from './components/PuzzleFilters';
import { AppBar, PuzzleHeader } from './components/PuzzleHeader';
import { SettingsPanel } from './components/SettingsPanel';
import { usePuzzle } from './hooks/usePuzzle';
import { usePrefersReducedMotion } from './hooks/usePrefersReducedMotion';

const fmt = (n: number) => n.toLocaleString('en-US');

export function App() {
  const puzzle = usePuzzle();
  const { session, library, progress, settings } = puzzle;
  const reducedMotion = usePrefersReducedMotion();
  const [view, setView] = useState<'puzzle' | 'progress' | 'settings'>('puzzle');

  useEffect(() => {
    if (puzzle.requestedView === 'progress') {
      setView('progress');
      puzzle.clearRequestedView();
    }
  }, [puzzle.requestedView, puzzle.clearRequestedView]);

  if (!session) {
    return (
      <main className="flex h-screen items-center justify-center text-ink-faint">
        <PixelKnight size={28} className="animate-pulse" />
      </main>
    );
  }

  const filtered = library && (library.filters.difficulty !== 'any' || library.filters.theme !== 'any');
  const progressOpen = view === 'progress' && progress !== null;
  const settingsOpen = view === 'settings';
  const showPanel = (next: 'progress' | 'settings') => setView((current) => (current === next ? 'puzzle' : next));

  return (
    <main className="mx-auto flex w-full max-w-[560px] flex-col gap-3 px-3 pt-3 pb-4">
      <header className="flex flex-col gap-2.5">
        <AppBar
          progress={progress}
          view={progressOpen ? 'progress' : settingsOpen ? 'settings' : 'puzzle'}
          onToggleProgress={() => showPanel('progress')}
          onToggleSettings={() => showPanel('settings')}
          soundOn={settings.sound}
          onToggleSound={puzzle.toggleSound}
          agentWorking={puzzle.agentWorking}
        />
        {!progressOpen && !settingsOpen && <PuzzleHeader puzzle={session.puzzle} />}
      </header>

      {progressOpen ? (
        <ProgressPanel progress={progress} onBack={() => setView('puzzle')} />
      ) : settingsOpen ? (
        <SettingsPanel
          settings={settings}
          hookInstalled={puzzle.hookInstalled}
          onChange={puzzle.updateSettings}
          onInstallHook={puzzle.installAgentHook}
          onBack={() => setView('puzzle')}
        />
      ) : (
        <>
          {library && <PuzzleFilters filters={library.filters} onChange={puzzle.setFilters} />}
          {puzzle.notice && (
            <p className="flex items-start gap-1.5 text-[11px] leading-snug text-gold" role="status">
              <Info size={12} className="mt-px shrink-0" />
              <span>{puzzle.notice}</span>
            </p>
          )}
          <ChessBoard
            session={session}
            selected={puzzle.selected}
            wrongSquare={puzzle.wrongSquare}
            hintSquare={puzzle.hintLevel >= 1 ? session.hintSquare : null}
            hintArrow={puzzle.hintLevel >= 2 ? session.hintMove : null}
            revealing={puzzle.feedback.kind === 'revealing'}
            promotion={puzzle.pendingPromotion !== null}
            palette={BOARD_THEMES[settings.boardTheme]}
            pieceStyle={settings.pieceStyle}
            motion={settings.animate && !reducedMotion}
            coordinates={settings.coordinates}
            solved={puzzle.feedback.kind === 'solved'}
            onMove={puzzle.tryMove}
            onSquareClick={puzzle.onSquareClick}
            onPieceDragStart={puzzle.onPieceDragStart}
            onDragCancel={puzzle.clearSelection}
            onPromote={puzzle.choosePromotion}
            onCancelPromotion={puzzle.cancelPromotion}
          />
          <PuzzleFeedback session={session} feedback={puzzle.feedback} attempt={puzzle.attempt} result={puzzle.result} />
          <PuzzleControls
            finished={puzzle.feedback.kind === 'solved' || puzzle.feedback.kind === 'failed'}
            canHint={session.isPlayerTurn && puzzle.hintLevel < 2}
            hintLevel={puzzle.hintLevel}
            canReveal={session.status === 'playing'}
            onHint={puzzle.showHint}
            onReveal={puzzle.revealSolution}
            onReset={puzzle.reset}
            onNext={puzzle.nextPuzzle}
          />
        </>
      )}

      <footer className="flex flex-col items-center gap-0.5 pt-1 text-center text-[10px] text-ink-faint">
        {library && (
          <span>
            {filtered ? `${fmt(library.matchingCount)} of ${fmt(library.totalCount)} puzzles match` : `${fmt(library.totalCount)} puzzles`}
            {' · '}
            <button type="button" className="link-btn" onClick={puzzle.importPuzzles}>
              Import more
            </button>
          </span>
        )}
        <span>
          From the{' '}
          <a href="https://database.lichess.org/#puzzles" className="underline decoration-dotted underline-offset-2 hover:text-ink-muted">
            Lichess puzzle database
          </a>{' '}
          (CC0)
        </span>
      </footer>
    </main>
  );
}
