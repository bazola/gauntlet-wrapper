import { mkdir, readFile, writeFile, access } from 'node:fs/promises';
import { join } from 'node:path';
import type {
  GauntletConfig,
  ReferencesCatalog,
  ProgressState,
  RequirementsFile,
} from '@gauntlet-wrapper/shared';
import { installNotificationHook } from '../hooks/hookInstaller.js';
import { setNotificationHookStatus } from './configStore.js';

async function exists(path: string): Promise<boolean> {
  try {
    await access(path);
    return true;
  } catch {
    return false;
  }
}

async function writeIfMissing(path: string, contents: string): Promise<void> {
  if (await exists(path)) return;
  await writeFile(path, contents, 'utf8');
}

async function ensureGitignoreEntry(projectPath: string): Promise<void> {
  const gitignorePath = join(projectPath, '.gitignore');
  const entry = '.gauntlet/';
  let current = '';
  if (await exists(gitignorePath)) {
    current = await readFile(gitignorePath, 'utf8');
    const alreadyPresent = current
      .split(/\r?\n/)
      .some((line) => line.trim().replace(/\/$/, '') === '.gauntlet');
    if (alreadyPresent) return;
  }
  const separator = current.length > 0 && !current.endsWith('\n') ? '\n' : '';
  const block = `${separator}\n# gauntlet-wrapper (local bookkeeping, never committed)\n${entry}\n`;
  await writeFile(gitignorePath, current + block, 'utf8');
}

// Idempotent: creates .gauntlet/ scaffold + files with sane defaults, but never
// overwrites anything that already exists, so re-registering an already-onboarded
// project is a no-op. Returns true if this run performed the *first* scaffold.
export async function onboardProject(
  projectId: string,
  projectPath: string,
  displayName: string,
  globalDefaultReviewerModel: string,
): Promise<{ freshlyOnboarded: boolean }> {
  const gauntletDir = join(projectPath, '.gauntlet');
  const configPath = join(gauntletDir, 'config.json');
  const wasAlreadyOnboarded = await exists(configPath);

  await mkdir(join(gauntletDir, 'references', 'photo'), { recursive: true });
  await mkdir(join(gauntletDir, 'references', 'video'), { recursive: true });
  await mkdir(join(gauntletDir, 'progress', 'generations'), { recursive: true });
  await mkdir(join(gauntletDir, 'goal-history'), { recursive: true });

  const now = new Date().toISOString();

  const config: GauntletConfig = {
    schemaVersion: 1,
    projectId,
    displayName,
    goalSummary: '',
    reviewerModel: globalDefaultReviewerModel,
    projectType: 'other',
    projectDocs: [],
    perfHarness: { scaffolded: false, kind: 'none', entryScript: null },
    visualFidelity: { enabled: false, splitSubLanes: false },
    temporalFidelity: { enabled: false },
    gameplayFidelity: { enabled: false },
    onboarding: { completed: false, scaffoldedAt: now, seedPromptDelivered: false },
    notificationHook: { installed: false, target: null },
    createdAt: now,
    updatedAt: now,
  };
  await writeIfMissing(configPath, JSON.stringify(config, null, 2));

  await writeIfMissing(
    join(gauntletDir, 'goal.md'),
    '# Goal\n\n_(not yet set -- edit this project\'s goal from the gauntlet-wrapper Config tab)_\n',
  );
  await writeIfMissing(
    join(gauntletDir, 'goal.meta.json'),
    JSON.stringify({ schemaVersion: 1, currentVersion: 0, history: [] }, null, 2),
  );

  const catalog: ReferencesCatalog = { schemaVersion: 1, photo: [], video: [], gameplay: [] };
  await writeIfMissing(join(gauntletDir, 'references', 'catalog.json'), JSON.stringify(catalog, null, 2));

  const progressState: ProgressState = {
    schemaVersion: 1,
    currentGeneration: 0,
    activeLanes: [],
    reviewerModel: globalDefaultReviewerModel,
    lastUpdatedAt: now,
  };
  await writeIfMissing(join(gauntletDir, 'progress', 'state.json'), JSON.stringify(progressState, null, 2));

  const requirements: RequirementsFile = { schemaVersion: 1, requirements: [] };
  await writeIfMissing(join(gauntletDir, 'progress', 'requirements.json'), JSON.stringify(requirements, null, 2));

  await ensureGitignoreEntry(projectPath);

  // Runs on every onboard call, not just the first -- keeps the hook command's
  // baked-in path/port current, and re-checks the tracked-file guard in case
  // .claude/settings.json got committed since the last time this ran.
  const hookTarget = await installNotificationHook(projectId, projectPath);
  await setNotificationHookStatus(projectPath, hookTarget);

  return { freshlyOnboarded: !wasAlreadyOnboarded };
}
