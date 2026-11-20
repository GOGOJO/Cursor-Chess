import { ArrowLeft, Check, Eye, X } from 'lucide-react';
import type { AttemptRecord, ProgressSnapshot } from '../../shared/progression';
import { displayThemes, themeLabel } from '../../shared/themes';

interface ProgressPanelProps {
  progress: ProgressSnapshot;
  onBack: () => void;
}

function Stat({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div className="stat-cell" title={hint}>
      <span className="text-[15px] font-semibold tabular-nums text-ink">{value}</span>
      <span className="text-[10px] uppercase tracking-wide text-ink-faint">{label}</span>
    </div>
  );
}

const CHART_W = 240;
const CHART_H = 64;
const CHART_PAD = 4;

export function RatingChart({ series }: { series: readonly number[] }) {
  if (series.length < 2) {
    return <p className="text-[11px] text-ink-faint">Your rating chart appears after your first rated puzzle.</p>;
  }
  const min = Math.min(...series);
  const max = Math.max(...series);
  const span = Math.max(max - min, 20);
  const mid = (max + min) / 2;
  const x = (i: number) => CHART_PAD + (i / (series.length - 1)) * (CHART_W - CHART_PAD * 2);
  const y = (v: number) => CHART_H / 2 - ((v - mid) / span) * (CHART_H - CHART_PAD * 2);
  const points = series.map((v, i) => `${x(i).toFixed(1)},${y(v).toFixed(1)}`);
  const last = series.length - 1;
  return (
    <div className="flex flex-col gap-1">
      <svg
        viewBox={`0 0 ${CHART_W} ${CHART_H}`}
        preserveAspectRatio="none"
        className="rating-chart"
        role="img"
        aria-label={`Rating over the last ${last} rated puzzles, from ${series[0]} to ${series[last]}`}
      >
        <polygon className="rating-chart-fill" points={`${x(0)},${CHART_H} ${points.join(' ')} ${x(last)},${CHART_H}`} />
        <polyline className="rating-chart-line" points={points.join(' ')} />
      </svg>
      <div className="flex justify-between text-[10px] tabular-nums text-ink-faint">
        <span>Low {min}</span>
        <span>Last {last} rated</span>
        <span>High {max}</span>
      </div>
    </div>
  );
}

function HistoryRow({ record }: { record: AttemptRecord }) {
  const delta = record.ratingAfter - record.ratingBefore;
  const icon = record.won ? (
    <Check size={12} strokeWidth={3} className="text-accent" />
  ) : record.revealed ? (
    <Eye size={12} strokeWidth={2.5} className="text-gold" />
  ) : record.solved ? (
    <Check size={12} strokeWidth={3} className="text-ink-faint" />
  ) : (
    <X size={12} strokeWidth={2.5} className="text-danger" />
  );
  const outcome = record.won ? 'Clean solve' : record.revealed ? 'Revealed' : record.solved ? 'Solved with help' : 'Missed';
  const theme = displayThemes(record.themes)[0];
  return (
    <li className="flex items-center gap-2 py-1 text-[11px]" title={`${outcome} · puzzle #${record.puzzleId}`}>
      {icon}
      <span className="w-9 tabular-nums text-ink-muted">{record.puzzleRating}</span>
      <span className="min-w-0 flex-1 truncate text-ink-muted">{theme ?? `#${record.puzzleId}`}</span>
      {record.xp > 0 && <span className="tabular-nums text-gold">+{record.xp}</span>}
      <span className={`w-8 text-right tabular-nums ${delta >= 0 ? 'text-accent' : 'text-danger'}`}>
        {delta >= 0 ? '+' : '−'}
        {Math.abs(delta)}
      </span>
    </li>
  );
}

export function ProgressPanel({ progress, onBack }: ProgressPanelProps) {
  const accuracy = progress.accuracy === null ? '–' : `${Math.round(progress.accuracy * 100)}%`;
  return (
    <section className="flex flex-col gap-4" aria-label="Progress">
      <div className="flex items-end justify-between gap-2">
        <div className="flex flex-col">
          <span className="text-[10px] uppercase tracking-wide text-ink-faint">Puzzle rating</span>
          <span className="text-[26px] font-semibold leading-none tabular-nums text-ink">{progress.rating}</span>
          <span className="mt-1 text-[11px] text-ink-muted">
            {progress.band} · best <span className="tabular-nums">{progress.highestRating}</span>
          </span>
        </div>
        <button type="button" className="link-btn flex items-center gap-1 text-[11px]" onClick={onBack}>
          <ArrowLeft size={12} />
          Back to puzzle
        </button>
      </div>

      <div className="grid grid-cols-3 gap-1.5">
        <Stat label="Solved" value={String(progress.solved)} />
        <Stat label="Accuracy" value={accuracy} hint="Rated puzzles solved with no mistakes or hints" />
        <Stat label="XP" value={String(progress.totalXp)} />
        <Stat label="Day streak" value={String(progress.dailyStreak)} hint={`Days in a row with a solve. Best ${progress.longestDailyStreak}.`} />
        <Stat label="Streak" value={String(progress.currentStreak)} hint={`Clean solves in a row. Best ${progress.longestStreak}.`} />
        <Stat label="Rated" value={String(progress.attempted)} />
      </div>

      <div className="flex flex-col gap-1.5">
        <h2 className="section-title">Rating</h2>
        <RatingChart series={progress.ratingSeries} />
      </div>

      {progress.topThemes.length > 0 && (
        <div className="flex flex-col gap-1.5">
          <h2 className="section-title">Top themes</h2>
          <ul className="flex flex-col gap-1.5">
            {progress.topThemes.map((stat) => {
              const pct = Math.round((stat.wins / stat.attempted) * 100);
              return (
                <li key={stat.theme} className="flex flex-col gap-0.5 text-[11px]">
                  <div className="flex justify-between">
                    <span className="text-ink-muted">{themeLabel(stat.theme)}</span>
                    <span className="tabular-nums text-ink-faint">
                      {pct}% of {stat.attempted}
                    </span>
                  </div>
                  <div className="theme-bar">
                    <span style={{ width: `${pct}%` }} />
                  </div>
                </li>
              );
            })}
          </ul>
        </div>
      )}

      <div className="flex flex-col gap-1">
        <h2 className="section-title">Recent</h2>
        {progress.recent.length === 0 ? (
          <p className="text-[11px] text-ink-faint">Solve a puzzle to start your history. A mistake, a hint, or a reveal counts as a miss.</p>
        ) : (
          <ul className="flex flex-col divide-y divide-line">
            {progress.recent.slice(0, 10).map((record) => (
              <HistoryRow key={record.attemptId} record={record} />
            ))}
          </ul>
        )}
      </div>
    </section>
  );
}
