import { readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import type { GauntletConfig } from '@gauntlet-wrapper/shared';
import type { HookInstallTarget } from '../hooks/hookInstaller.js';

function configPath(projectPath: string): string {
  return join(projectPath, '.gauntlet', 'config.json');
}

export async function readConfig(projectPath: string): Promise<GauntletConfig> {
  const raw = await readFile(configPath(projectPath), 'utf8');
  return JSON.parse(raw) as GauntletConfig;
}

async function writeConfig(projectPath: string, config: GauntletConfig): Promise<void> {
  await writeFile(configPath(projectPath), JSON.stringify(config, null, 2), 'utf8');
}

// Targeted setters rather than a generic patch() -- GauntletConfig has nested
// objects (onboarding, perfHarness, ...) that a shallow merge would clobber.

export async function setReviewerModel(projectPath: string, reviewerModel: string): Promise<GauntletConfig> {
  const current = await readConfig(projectPath);
  const next: GauntletConfig = { ...current, reviewerModel, updatedAt: new Date().toISOString() };
  await writeConfig(projectPath, next);
  return next;
}

export async function setGoalSummary(projectPath: string, goalSummary: string): Promise<void> {
  const current = await readConfig(projectPath);
  await writeConfig(projectPath, { ...current, goalSummary, updatedAt: new Date().toISOString() });
}

export async function markSeedPromptDelivered(projectPath: string): Promise<void> {
  const current = await readConfig(projectPath);
  await writeConfig(projectPath, {
    ...current,
    onboarding: { ...current.onboarding, completed: true, seedPromptDelivered: true },
    updatedAt: new Date().toISOString(),
  });
}

export async function setNotificationHookStatus(projectPath: string, target: HookInstallTarget): Promise<void> {
  const current = await readConfig(projectPath);
  await writeConfig(projectPath, {
    ...current,
    notificationHook: { installed: true, target },
    updatedAt: new Date().toISOString(),
  });
}
