import { execPath } from 'node:process';
import { dirname } from 'node:path';
import * as vscode from 'vscode';
import type { PuzzleViewProvider } from '../puzzleViewProvider';
import type { StorageService } from '../storage/storageService';
import { AgentActivity, followBoard, idleBoardFollow, type BoardFollowState } from './agentActivity';
import { startEventTail } from './eventTail';
import { hookAlreadyInstalled, hookPaths, installHookFiles, readHookConfig } from './hookConfig';

const CONSENT =
  'Add a small hook in your home folder so Cursor Chess can tell when an agent starts and finishes? It records only those moments, not your prompts.';

export function startAgentNotices(storage: StorageService, provider: PuzzleViewProvider): vscode.Disposable {
  const paths = hookPaths();
  const home = dirname(dirname(paths.config));
  const status = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Right, 100);
  status.name = 'Cursor Chess agent';
  status.command = 'cursorChess.open';
  status.tooltip = 'An agent is working. Cursor Chess will tell you when it finishes.';

  const publish = (agentStatus: 'idle' | 'working' | 'finished') => {
    if (agentStatus === 'idle') status.hide();
    else {
      status.text = agentStatus === 'working' ? '$(pulse) Agent' : '$(bell) Agent finished';
      status.tooltip = agentStatus === 'working' ? 'An agent is working.' : 'An agent finished. The notice waits until this puzzle is done.';
      status.show();
    }
    provider.postAgent({ working: agentStatus === 'working', hookInstalled: hookAlreadyInstalled(readHookConfig(home)) });
  };

  let follow: BoardFollowState = idleBoardFollow();
  let syncBoard = () => {};

  const activity = new AgentActivity({
    notificationsEnabled: () => storage.getSettings().notifyOnAgent,
    onStatus: (agentStatus) => {
      publish(agentStatus);
      syncBoard();
    },
    onNotice: () => {
      void vscode.window.showInformationMessage('Agent finished.', 'Open puzzle').then((choice) => {
        if (choice) void vscode.commands.executeCommand('cursorChess.open');
      });
    },
  });

  syncBoard = () => {
    const decision = followBoard({
      ...follow,
      enabled: storage.getSettings().openWithAgent,
      working: activity.working,
      viewVisible: provider.isViewVisible(),
    });
    const { action, ...next } = decision;
    follow = next;
    if (action === 'reveal') {
      void Promise.resolve(vscode.commands.executeCommand('cursorChess.open')).then(
        () => {
          follow = { ...follow, opening: false };
          syncBoard();
        },
        () => {
          follow = { ...follow, opening: false };
          syncBoard();
        },
      );
    } else if (action === 'hide') {
      void vscode.commands.executeCommand('workbench.action.closeSidebar');
    }
  };

  const stopTail = startEventTail(paths.events, (event) => activity.ingest(event));

  const enable = async () => {
    if (process.platform === 'win32') {
      void vscode.window.showInformationMessage('The agent hook setup runs on macOS and Linux. Use Cursor Chess: Agent Finished to mark it yourself.');
      return;
    }
    if (hookAlreadyInstalled(readHookConfig(home))) {
      installHookFiles(home, execPath);
      void vscode.window.showInformationMessage('Agent notices are already set up.');
      publish(activity.working ? 'working' : 'idle');
      return;
    }
    const choice = await vscode.window.showInformationMessage(CONSENT, 'Install', 'Not now');
    if (choice !== 'Install') return;
    const result = installHookFiles(home, execPath);
    if (result === 'invalid') {
      void vscode.window.showErrorMessage('Could not set up agent notices because ~/.cursor/hooks.json is not valid JSON. It was left unchanged.');
      return;
    }
    void vscode.window.showInformationMessage('Agent notices are set up. They start with the next agent run.');
    publish(activity.working ? 'working' : 'idle');
  };

  // Keep the script pointed at this editor after an update, without asking again.
  if (process.platform !== 'win32' && hookAlreadyInstalled(readHookConfig(home))) {
    installHookFiles(home, execPath);
  }

  provider.bindAgent({
    setPuzzleBusy: (busy) => activity.setPuzzleBusy(busy),
    setViewVisible: (visible) => activity.setViewVisible(visible),
    hookInstalled: () => hookAlreadyInstalled(readHookConfig(home)),
    working: () => activity.working,
    enable,
    onSettingsChanged: () => syncBoard(),
  });

  return vscode.Disposable.from(
    { dispose: stopTail },
    status,
    vscode.commands.registerCommand('cursorChess.enableAgentNotices', enable),
    vscode.commands.registerCommand('cursorChess.agentWorking', () => activity.setManualWorking(true)),
    vscode.commands.registerCommand('cursorChess.agentFinished', () => activity.markFinished()),
    vscode.commands.registerCommand('cursorChess.showStatistics', async () => {
      await vscode.commands.executeCommand('cursorChess.open');
      provider.showProgress();
    }),
    vscode.commands.registerCommand('cursorChess.toggleNotifications', async () => {
      const current = storage.getSettings();
      const next = await storage.setSettings({ ...current, notifyOnAgent: !current.notifyOnAgent });
      activity.setNotificationsEnabled(next.notifyOnAgent);
      provider.postSettings();
      void vscode.window.setStatusBarMessage(next.notifyOnAgent ? 'Agent notices on' : 'Agent notices off', 2500);
    }),
  );
}
