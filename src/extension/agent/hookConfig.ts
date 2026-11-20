import { chmodSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';

export const HOOK_COMMAND = './hooks/cursor-chess-agent.sh';
const HOOK_EVENTS = ['sessionStart', 'subagentStart', 'subagentStop', 'stop'] as const;

export function hookPaths(home = homedir()) {
  const dir = join(home, '.cursor', 'hooks');
  return {
    dir,
    script: join(dir, 'cursor-chess-agent.mjs'),
    wrapper: join(dir, 'cursor-chess-agent.sh'),
    config: join(home, '.cursor', 'hooks.json'),
    events: join(dir, 'cursor-chess-events.jsonl'),
  };
}

export function hookAlreadyInstalled(raw: string | undefined): boolean {
  if (!raw) return false;
  try {
    const parsed = JSON.parse(raw) as { hooks?: Record<string, { command?: string }[]> };
    return HOOK_EVENTS.every((event) => parsed.hooks?.[event]?.some((hook) => hook?.command === HOOK_COMMAND));
  } catch {
    return false;
  }
}

/**
 * Adds the Cursor Chess hook beside any hooks already in the file.
 * Refuses to touch a file that is not valid JSON.
 */
export function mergeHookConfig(raw: string | undefined): { text: string } | { error: string } {
  let parsed: Record<string, unknown> = {};
  if (raw && raw.trim()) {
    try {
      const value = JSON.parse(raw) as unknown;
      if (!value || typeof value !== 'object' || Array.isArray(value)) return { error: 'hooks.json is not an object' };
      parsed = value as Record<string, unknown>;
    } catch {
      return { error: 'hooks.json is not valid JSON' };
    }
  }
  if (parsed.version === undefined) parsed.version = 1;
  const hooks = parsed.hooks && typeof parsed.hooks === 'object' && !Array.isArray(parsed.hooks) ? (parsed.hooks as Record<string, unknown>) : {};
  for (const event of HOOK_EVENTS) {
    const list = Array.isArray(hooks[event]) ? [...(hooks[event] as unknown[])] : [];
    const present = list.some((hook) => !!hook && typeof hook === 'object' && (hook as { command?: string }).command === HOOK_COMMAND);
    if (!present) list.push({ command: HOOK_COMMAND });
    hooks[event] = list;
  }
  parsed.hooks = hooks;
  return { text: `${JSON.stringify(parsed, null, 2)}\n` };
}

/** Keeps hook_event_name, ids, and status. Nothing else is written to disk. */
export function agentHookProgram(): string {
  return `import { appendFileSync, mkdirSync } from 'node:fs';
import { homedir } from 'node:os';
import { dirname, join } from 'node:path';

const chunks = [];
for await (const chunk of process.stdin) chunks.push(chunk);
let data = {};
try {
  data = JSON.parse(Buffer.concat(chunks).toString('utf8') || '{}');
} catch {
  data = {};
}
const keep = {};
for (const key of ['hook_event_name', 'conversation_id', 'session_id', 'subagent_id', 'status']) {
  if (typeof data[key] === 'string') keep[key] = data[key];
}
const file = join(homedir(), '.cursor', 'hooks', 'cursor-chess-events.jsonl');
mkdirSync(dirname(file), { recursive: true });
appendFileSync(file, JSON.stringify(keep) + '\\n');
process.stdout.write('{}\\n');
`;
}

export function agentHookWrapper(nodePath: string): string {
  const quoted = `'${nodePath.replace(/'/g, `'\\''`)}'`;
  return `#!/bin/sh
export ELECTRON_RUN_AS_NODE=1
exec ${quoted} "$HOME/.cursor/hooks/cursor-chess-agent.mjs"
`;
}

export type HookInstallResult = 'installed' | 'unchanged' | 'invalid';

/** Writes the script and merges ~/.cursor/hooks.json. Does not ask; the caller got consent. */
export function installHookFiles(home: string, nodePath: string): HookInstallResult {
  const paths = hookPaths(home);
  let current: string | undefined;
  try {
    current = readFileSync(paths.config, 'utf8');
  } catch {
    current = undefined;
  }
  const merged = mergeHookConfig(current);
  if ('error' in merged) return 'invalid';
  const wrapper = agentHookWrapper(nodePath);
  const program = agentHookProgram();
  let sameScripts = false;
  try {
    sameScripts = readFileSync(paths.wrapper, 'utf8') === wrapper && readFileSync(paths.script, 'utf8') === program;
  } catch {
    sameScripts = false;
  }
  if (current === merged.text && sameScripts) return 'unchanged';
  mkdirSync(paths.dir, { recursive: true });
  writeFileSync(paths.script, program, 'utf8');
  writeFileSync(paths.wrapper, wrapper, { encoding: 'utf8', mode: 0o755 });
  chmodSync(paths.wrapper, 0o755);
  if (current !== merged.text) writeFileSync(paths.config, merged.text, 'utf8');
  return 'installed';
}

export function readHookConfig(home: string): string | undefined {
  try {
    return readFileSync(hookPaths(home).config, 'utf8');
  } catch {
    return undefined;
  }
}
