/** The few fields the hook is allowed to keep. Prompts, tasks, and summaries are dropped. */
export interface HookEvent {
  hook_event_name?: string;
  conversation_id?: string;
  session_id?: string;
  subagent_id?: string;
  status?: string;
}

export interface ActivityCounts {
  sessions: number;
  subagents: number;
  /** Set from the manual commands, for when no hook is installed. */
  manual: boolean;
}

export const emptyActivity = (): ActivityCounts => ({ sessions: 0, subagents: 0, manual: false });

const KEPT_FIELDS = ['hook_event_name', 'conversation_id', 'session_id', 'subagent_id', 'status'] as const;

export function selectHookFields(value: unknown): HookEvent | null {
  if (!value || typeof value !== 'object') return null;
  const raw = value as Record<string, unknown>;
  if (typeof raw.hook_event_name !== 'string' || raw.hook_event_name.length === 0) return null;
  const event: HookEvent = {};
  for (const key of KEPT_FIELDS) {
    if (typeof raw[key] === 'string') event[key] = raw[key];
  }
  return event;
}

export function parseHookLine(line: string): HookEvent | null {
  const trimmed = line.trim();
  if (!trimmed) return null;
  try {
    return selectHookFields(JSON.parse(trimmed));
  } catch {
    return null;
  }
}

/** Splits off every complete line and keeps a trailing partial line for the next read. */
export function splitCompleteLines(buffer: string): { lines: string[]; rest: string } {
  const parts = buffer.split('\n');
  const rest = parts.pop() ?? '';
  return { lines: parts, rest };
}

export function isWorking(counts: ActivityCounts): boolean {
  return counts.sessions > 0 || counts.subagents > 0 || counts.manual;
}

/**
 * Folds one hook event into the activity counts. A notice is due only when the
 * top-level agent stops with status `completed`. Subagents keep the indicator on
 * without counting as the agent finishing.
 */
export function applyHookEvent(counts: ActivityCounts, event: HookEvent): { counts: ActivityCounts; finished: boolean } {
  const next = { ...counts };
  let finished = false;
  switch (event.hook_event_name) {
    case 'sessionStart':
      next.sessions += 1;
      break;
    case 'sessionEnd':
      next.sessions = Math.max(0, next.sessions - 1);
      break;
    case 'subagentStart':
      next.subagents += 1;
      break;
    case 'subagentStop':
      next.subagents = Math.max(0, next.subagents - 1);
      break;
    case 'stop':
      next.sessions = Math.max(0, next.sessions - 1);
      finished = event.status === 'completed';
      break;
    default:
      break;
  }
  return { counts: next, finished };
}

export interface NoticeGate {
  pending: boolean;
  notificationsEnabled: boolean;
  /** The puzzle sidebar is open. */
  viewVisible: boolean;
  /** A puzzle is on the board and not yet solved or revealed. */
  puzzleBusy: boolean;
}

/** Holds the notice while a puzzle is on screen. Drops it when notices are off. */
export function gateNotice(gate: NoticeGate): { show: boolean; pending: boolean } {
  if (!gate.pending) return { show: false, pending: false };
  if (!gate.notificationsEnabled) return { show: false, pending: false };
  if (gate.viewVisible && gate.puzzleBusy) return { show: false, pending: true };
  return { show: true, pending: false };
}

export interface BoardFollowState {
  enabled: boolean;
  /** An agent, subagent, or the manual working mark is in progress. */
  working: boolean;
  /** The puzzle sidebar is on screen. */
  viewVisible: boolean;
  /** This stretch of work has been seen already. */
  latched: boolean;
  /** The board was already open when the agent started. */
  alreadyOpen: boolean;
  /** The board was opened for this agent. */
  openedByUs: boolean;
  /** The editor has been asked to show the board, and has not answered yet. */
  opening: boolean;
  /** The board we opened has actually appeared. */
  seenOpen: boolean;
  /** The player closed the board we opened, so it stays closed until the next agent. */
  dismissed: boolean;
}

export const idleBoardFollow = (): BoardFollowState => ({
  enabled: false,
  working: false,
  viewVisible: false,
  latched: false,
  alreadyOpen: false,
  openedByUs: false,
  opening: false,
  seenOpen: false,
  dismissed: false,
});

/**
 * Decides whether the puzzle sidebar should appear or hide as an agent starts
 * and stops. A board the player already had open is left alone. Closing the
 * board we opened dismisses it for the rest of that stretch of work.
 */
export function followBoard(state: BoardFollowState): BoardFollowState & { action: 'reveal' | 'hide' | 'none' } {
  const reset = { ...idleBoardFollow(), enabled: state.enabled, working: state.working, viewVisible: state.viewVisible, action: 'none' as const };
  if (!state.enabled) return reset;

  if (!state.working) {
    if (state.openedByUs && state.viewVisible && !state.dismissed) return { ...reset, action: 'hide' };
    return reset;
  }

  const latched = state.latched;
  const alreadyOpen = latched ? state.alreadyOpen : state.viewVisible;
  const openedByUs = latched ? state.openedByUs : false;
  const opening = latched ? state.opening : false;
  const seenOpen = latched ? state.seenOpen || state.viewVisible : false;
  const dismissed = latched ? state.dismissed : false;
  const next = {
    enabled: true,
    working: true,
    viewVisible: state.viewVisible,
    latched: true,
    alreadyOpen,
    openedByUs,
    opening,
    seenOpen,
    dismissed,
  };

  if (alreadyOpen || dismissed) return { ...next, action: 'none' };

  if (state.viewVisible) return { ...next, opening: false, seenOpen: openedByUs || seenOpen, action: 'none' };

  // Hidden again after it was shown: the player closed it. Hidden before the first
  // show is just the editor catching up, including when focus returns before the view does.
  if (openedByUs && !opening && seenOpen) return { ...next, dismissed: true, action: 'none' };

  if (opening || openedByUs) return { ...next, action: 'none' };

  return { ...next, openedByUs: true, opening: true, action: 'reveal' };
}

const NOTICE_GAP_MS = 4000;

export class AgentActivity {
  private counts: ActivityCounts = emptyActivity();
  private pending = false;
  private puzzleBusy = false;
  private viewVisible = false;
  private notificationsEnabled: boolean;
  private lastNoticeAt = 0;

  constructor(
    private readonly options: {
      notificationsEnabled: () => boolean;
      onStatus: (status: 'idle' | 'working' | 'finished') => void;
      onNotice: () => void;
      now?: () => number;
    },
  ) {
    this.notificationsEnabled = options.notificationsEnabled();
  }

  get working(): boolean {
    return isWorking(this.counts);
  }

  ingest(event: HookEvent): void {
    const next = applyHookEvent(this.counts, event);
    this.counts = next.counts;
    if (next.finished) this.pending = true;
    this.flush();
  }

  setManualWorking(working: boolean): void {
    if (this.counts.manual === working) return;
    this.counts = { ...this.counts, manual: working };
    this.publish();
  }

  /** The manual fallback for "the agent finished". */
  markFinished(): void {
    this.counts = { ...this.counts, manual: false };
    this.pending = true;
    this.flush();
  }

  setPuzzleBusy(busy: boolean): void {
    this.puzzleBusy = busy;
    this.flush();
  }

  setViewVisible(visible: boolean): void {
    this.viewVisible = visible;
    this.flush();
  }

  setNotificationsEnabled(enabled: boolean): void {
    this.notificationsEnabled = enabled;
    this.flush();
  }

  private flush(): void {
    const decision = gateNotice({
      pending: this.pending,
      notificationsEnabled: this.notificationsEnabled,
      viewVisible: this.viewVisible,
      puzzleBusy: this.puzzleBusy,
    });
    this.pending = decision.pending;
    this.publish();
    if (!decision.show) return;
    const now = this.options.now?.() ?? Date.now();
    if (now - this.lastNoticeAt < NOTICE_GAP_MS) return;
    this.lastNoticeAt = now;
    this.options.onNotice();
  }

  private publish(): void {
    const status = isWorking(this.counts) ? 'working' : this.pending ? 'finished' : 'idle';
    this.options.onStatus(status);
  }
}
