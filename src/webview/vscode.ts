import { sanitizeAttempt, StorageService, type KeyValueStore } from '../extension/storage/storageService';
import type { ExtensionToWebviewMessage, WebviewToExtensionMessage } from '../shared/messages';
import { chooseNextPuzzle, PuzzleLibrary } from '../shared/puzzleLibrary';
import { SAMPLE_PUZZLES } from '../shared/samplePuzzles';
import type { Puzzle } from '../shared/types';

interface VsCodeApi {
  postMessage(message: unknown): void;
}

declare global {
  function acquireVsCodeApi(): VsCodeApi;
}

type Listener = (message: ExtensionToWebviewMessage) => void;
const listeners = new Set<Listener>();

window.addEventListener('message', (event: MessageEvent<ExtensionToWebviewMessage>) => {
  for (const listener of listeners) listener(event.data);
});

/** Keeps the browser preview's progress across reloads, like `globalState` does in the editor. */
function localStore(): KeyValueStore {
  return {
    get<T>(key: string, defaultValue: T): T {
      const raw = window.localStorage.getItem(key);
      if (raw === null) return defaultValue;
      try {
        return JSON.parse(raw) as T;
      } catch {
        return defaultValue;
      }
    },
    update(key, value) {
      if (value === undefined) window.localStorage.removeItem(key);
      else window.localStorage.setItem(key, JSON.stringify(value));
      return Promise.resolve();
    },
  };
}

/** Stands in for the extension host when the UI runs in a plain browser (`npm run dev:webview`). */
function createBrowserFallback(): VsCodeApi {
  const library = new PuzzleLibrary(SAMPLE_PUZZLES);
  const storage = new StorageService(localStore());
  let current: { puzzle: Puzzle; notice?: string } | undefined;
  const reply = (message: ExtensionToWebviewMessage) => setTimeout(() => window.postMessage(message, '*'), 0);

  const sendLibrary = () => {
    const filters = storage.getFilters();
    reply({
      type: 'library',
      library: { filters, totalCount: library.totalCount, importedCount: 0, matchingCount: library.matching(filters).length },
    });
  };
  const sendCurrent = () => {
    if (!current) return;
    const saved = storage.getActiveAttempt();
    reply({ type: 'loadPuzzle', ...current, resume: saved?.puzzleId === current.puzzle.id ? saved : undefined });
  };
  const sendNext = async () => {
    await storage.clearActiveAttempt();
    current = chooseNextPuzzle(library, storage.getFilters(), storage.getRecentPuzzleIds());
    await storage.recordPuzzleShown(current.puzzle.id);
    sendCurrent();
  };

  const handle = async (message: WebviewToExtensionMessage): Promise<void> => {
    switch (message.type) {
      case 'ready': {
        sendLibrary();
        reply({ type: 'settings', settings: storage.getSettings() });
        reply({ type: 'progress', progress: storage.getSnapshot() });
        const saved = storage.getActiveAttempt();
        const puzzle = saved && !saved.solved && !saved.revealed ? library.get(saved.puzzleId) : undefined;
        if (current) {
          sendCurrent();
        } else if (puzzle) {
          current = { puzzle };
          sendCurrent();
        } else {
          await sendNext();
        }
        break;
      }
      case 'requestNextPuzzle':
        await sendNext();
        break;
      case 'attempt': {
        const attempt = sanitizeAttempt(message.attempt);
        if (!attempt || !current || attempt.puzzleId !== current.puzzle.id) break;
        if (await storage.recordAttempt(attempt, current.puzzle)) {
          reply({ type: 'progress', progress: storage.getSnapshot() });
        }
        break;
      }
        case 'setSettings':
          reply({ type: 'settings', settings: await storage.setSettings(message.settings) });
          break;
        case 'setFilters':
        await storage.setFilters(message.filters);
        sendLibrary();
        await sendNext();
        break;
      case 'importPuzzles':
        console.info('Importing needs the extension host. Run the extension with F5 to try it.');
        break;
    }
  };

  // Handled one at a time, so React's doubled `ready` in development can't pick two puzzles.
  let queue: Promise<void> = Promise.resolve();
  return {
    postMessage(raw) {
      queue = queue.then(() => handle(raw as WebviewToExtensionMessage)).catch((error) => console.error(error));
    },
  };
}

const api: VsCodeApi = typeof acquireVsCodeApi === 'function' ? acquireVsCodeApi() : createBrowserFallback();

export function postToExtension(message: WebviewToExtensionMessage): void {
  api.postMessage(message);
}

export function onExtensionMessage(listener: Listener): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}
