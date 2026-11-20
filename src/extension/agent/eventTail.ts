import { openSync, readSync, statSync, closeSync } from 'node:fs';
import { parseHookLine, splitCompleteLines, type HookEvent } from './agentActivity';

/**
 * Reads only the bytes appended after startup, so an old finish does not
 * notify again when the extension loads. Checks once a second.
 */
export function startEventTail(file: string, onEvent: (event: HookEvent) => void): () => void {
  let offset = 0;
  try {
    offset = statSync(file).size;
  } catch {
    offset = 0;
  }
  let rest = '';
  let timer: ReturnType<typeof setInterval> | undefined;

  const tick = () => {
    let size = 0;
    try {
      size = statSync(file).size;
    } catch {
      return;
    }
    if (size < offset) {
      offset = 0;
      rest = '';
    }
    if (size === offset) return;
    const length = size - offset;
    const buffer = Buffer.alloc(length);
    const fd = openSync(file, 'r');
    try {
      readSync(fd, buffer, 0, length, offset);
    } finally {
      closeSync(fd);
    }
    offset = size;
    const split = splitCompleteLines(rest + buffer.toString('utf8'));
    rest = split.rest;
    for (const line of split.lines) {
      const event = parseHookLine(line);
      if (event) onEvent(event);
    }
  };

  timer = setInterval(tick, 1000);
  return () => clearInterval(timer);
}
