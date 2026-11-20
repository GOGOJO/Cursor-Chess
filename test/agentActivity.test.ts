import { mkdirSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { AgentActivity, applyHookEvent, emptyActivity, followBoard, gateNotice, idleBoardFollow, parseHookLine, splitCompleteLines, type BoardFollowState } from '../src/extension/agent/agentActivity';
import { agentHookProgram, agentHookWrapper, hookAlreadyInstalled, installHookFiles, mergeHookConfig } from '../src/extension/agent/hookConfig';

describe('hook events', () => {
  it('keeps only start and stop fields', () => {
    expect(parseHookLine('')).toBeNull();
    expect(parseHookLine('not json')).toBeNull();
    expect(
      parseHookLine(JSON.stringify({ hook_event_name: 'subagentStop', status: 'completed', task: 'read the repo', summary: 'done' })),
    ).toEqual({ hook_event_name: 'subagentStop', status: 'completed' });
  });

  it('holds a partial line until it is finished', () => {
    expect(splitCompleteLines('{"hook_event_name":"stop"}\n{"hook_')).toEqual({
      lines: ['{"hook_event_name":"stop"}'],
      rest: '{"hook_',
    });
  });

  it('turns the indicator on for a session or a subagent, and notices only a completed stop', () => {
    let counts = emptyActivity();
    counts = applyHookEvent(counts, { hook_event_name: 'sessionStart' }).counts;
    expect(applyHookEvent(counts, { hook_event_name: 'subagentStart' }).counts).toMatchObject({ sessions: 1, subagents: 1 });
    const stopped = applyHookEvent(counts, { hook_event_name: 'stop', status: 'completed' });
    expect(stopped.finished).toBe(true);
    expect(stopped.counts.sessions).toBe(0);
    expect(applyHookEvent(counts, { hook_event_name: 'stop', status: 'aborted' }).finished).toBe(false);
    expect(applyHookEvent(counts, { hook_event_name: 'subagentStop', status: 'completed' }).finished).toBe(false);
    expect(applyHookEvent(emptyActivity(), { hook_event_name: 'stop', status: 'completed' }).counts.sessions).toBe(0);
  });
});

describe('notice gate', () => {
  const base = { pending: true, notificationsEnabled: true, viewVisible: false, puzzleBusy: true };

  it('waits while the puzzle is on screen and shows once it is not', () => {
    expect(gateNotice({ ...base, viewVisible: true })).toEqual({ show: false, pending: true });
    expect(gateNotice({ ...base, viewVisible: true, puzzleBusy: false })).toEqual({ show: true, pending: false });
    expect(gateNotice({ ...base, viewVisible: false })).toEqual({ show: true, pending: false });
  });

  it('drops a held notice when notifications are turned off', () => {
    expect(gateNotice({ ...base, notificationsEnabled: false })).toEqual({ show: false, pending: false });
  });
});

describe('follow the agent', () => {
  const step = (state: BoardFollowState, patch: Partial<BoardFollowState>) => followBoard({ ...state, ...patch });

  it('opens a hidden board when an agent starts, then closes it', () => {
    const opened = step(idleBoardFollow(), { enabled: true, working: true, viewVisible: false });
    expect(opened.action).toBe('reveal');
    expect(opened.openedByUs).toBe(true);

    const showing = step(opened, { viewVisible: true, opening: false });
    expect(showing.action).toBe('none');
    expect(showing.openedByUs).toBe(true);

    const closed = step(showing, { working: false });
    expect(closed.action).toBe('hide');
    expect(closed.openedByUs).toBe(false);
  });

  it('leaves a board the player already had open', () => {
    const started = step(idleBoardFollow(), { enabled: true, working: true, viewVisible: true });
    expect(started.action).toBe('none');
    expect(started.alreadyOpen).toBe(true);
    expect(step(started, { working: false, viewVisible: true }).action).toBe('none');
  });

  it('does not reopen a board the player closed during the agent', () => {
    const opened = step(idleBoardFollow(), { enabled: true, working: true });
    const showing = step(opened, { viewVisible: true, opening: false });
    const dismissed = step(showing, { viewVisible: false });
    expect(dismissed.dismissed).toBe(true);
    expect(dismissed.action).toBe('none');
    expect(step(dismissed, { viewVisible: false }).action).toBe('none');
    expect(step(dismissed, { working: false }).action).toBe('none');
  });

  it('stays still when the setting is off', () => {
    const off = step(idleBoardFollow(), { enabled: false, working: true, viewVisible: false });
    expect(off.action).toBe('none');
    expect(off.openedByUs).toBe(false);
  });
});

describe('AgentActivity', () => {
  function create(notificationsEnabled = true) {
    const notices: number[] = [];
    const working: string[] = [];
    let now = 10_000;
    const activity = new AgentActivity({
      notificationsEnabled: () => notificationsEnabled,
      onStatus: (value) => working.push(value),
      onNotice: () => notices.push(now),
      now: () => now,
    });
    return { activity, notices, working, setNow: (value: number) => (now = value) };
  }

  it('holds the notice during a puzzle, then shows it once', () => {
    const { activity, notices, working } = create();
    activity.setViewVisible(true);
    activity.setPuzzleBusy(true);
    activity.ingest({ hook_event_name: 'sessionStart' });
    activity.ingest({ hook_event_name: 'stop', status: 'completed' });
    expect(working.at(-2)).toBe('working');
    expect(working.at(-1)).toBe('finished');
    expect(notices).toEqual([]);
    activity.setPuzzleBusy(false);
    expect(notices).toHaveLength(1);
    expect(working.at(-1)).toBe('idle');
    activity.setPuzzleBusy(true);
    activity.setPuzzleBusy(false);
    expect(notices).toHaveLength(1);
  });

  it('shows immediately when the sidebar is hidden, and skips a second finish moments later', () => {
    const { activity, notices, setNow } = create();
    activity.ingest({ hook_event_name: 'stop', status: 'completed' });
    expect(notices).toHaveLength(1);
    setNow(11_000);
    activity.ingest({ hook_event_name: 'stop', status: 'completed' });
    expect(notices).toHaveLength(1);
    setNow(15_000);
    activity.markFinished();
    expect(notices).toHaveLength(2);
  });

  it('drops a waiting notice when notifications are turned off', () => {
    const { activity, notices } = create();
    activity.setViewVisible(true);
    activity.setPuzzleBusy(true);
    activity.ingest({ hook_event_name: 'stop', status: 'completed' });
    activity.setNotificationsEnabled(false);
    activity.setPuzzleBusy(false);
    expect(notices).toEqual([]);
  });
});

describe('hook install', () => {
  it('adds the hook beside an existing one and refuses an invalid file', () => {
    const merged = mergeHookConfig('{"version":1,"hooks":{"stop":[{"command":"./mine.sh"}]}}');
    expect('text' in merged).toBe(true);
    if (!('text' in merged)) return;
    const parsed = JSON.parse(merged.text);
    expect(parsed.hooks.stop.map((hook: { command: string }) => hook.command)).toEqual(['./mine.sh', './hooks/cursor-chess-agent.sh']);
    expect(hookAlreadyInstalled(merged.text)).toBe(true);
    const again = mergeHookConfig(merged.text);
    expect('text' in again && again.text).toBe(merged.text);
    expect(mergeHookConfig('{')).toEqual({ error: 'hooks.json is not valid JSON' });
  });

  it('writes the script without prompt text and leaves an invalid config untouched', () => {
    expect(agentHookProgram()).not.toContain('summary');
    expect(agentHookProgram()).not.toContain('task');
    expect(agentHookWrapper("/App's/Cursor")).toContain(`'/App'\\''s/Cursor'`);

    const home = mkdtempSync(join(tmpdir(), 'cursor-chess-hooks-'));
    writeInvalid(home);
    expect(installHookFiles(home, '/usr/bin/cursor')).toBe('invalid');
    expect(readFileSync(join(home, '.cursor', 'hooks.json'), 'utf8')).toBe('{');

    const fresh = mkdtempSync(join(tmpdir(), 'cursor-chess-hooks-'));
    expect(installHookFiles(fresh, '/usr/bin/cursor')).toBe('installed');
    expect(installHookFiles(fresh, '/usr/bin/cursor')).toBe('unchanged');
    expect(readFileSync(join(fresh, '.cursor', 'hooks', 'cursor-chess-agent.sh'), 'utf8')).toContain('/usr/bin/cursor');
  });
});

function writeInvalid(home: string) {
  mkdirSync(join(home, '.cursor'), { recursive: true });
  writeFileSync(join(home, '.cursor', 'hooks.json'), '{');
}
