import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { HOOK_SCRIPTS_DIR } from '../config/paths.js';
import { SERVER_PORT } from '../config/serverPort.js';

const execFileAsync = promisify(execFile);

export type HookInstallTarget = 'settings.json' | 'settings.local.json';

interface HookEntry {
  matcher?: string;
  hooks: Array<{ type: string; command: string }>;
}

interface ClaudeSettingsFile {
  hooks?: {
    Notification?: HookEntry[];
    [otherEvent: string]: HookEntry[] | undefined;
  };
  [otherKey: string]: unknown;
}

// A repo with .claude/settings.json already committed is common for team
// projects -- auto-merging a machine-specific absolute path + port into a
// tracked file would leak local machine layout into shared git history the
// next time someone commits. settings.local.json is Claude Code's own
// personal-overrides convention, gitignored by default, so that's the
// fallback whenever settings.json is already under version control.
async function isSettingsJsonTracked(projectPath: string): Promise<boolean> {
  try {
    await execFileAsync('git', ['ls-files', '--error-unmatch', '.claude/settings.json'], { cwd: projectPath });
    return true;
  } catch {
    return false; // untracked, not a git repo, or git unavailable -- settings.json is safe to use directly
  }
}

function buildHookCommand(projectId: string): string {
  const scriptPath = join(HOOK_SCRIPTS_DIR, 'notify.mjs');
  return `node "${scriptPath}" --project ${projectId} --port ${SERVER_PORT}`;
}

// Identifies an entry this installer previously wrote, by the two substrings
// only our own installed command will ever contain -- lets re-onboarding
// update the port/path in place instead of accumulating duplicate entries,
// without disturbing any Notification hooks the project's own team added.
function isOurEntry(entry: HookEntry): boolean {
  return entry.hooks.some((h) => h.command.includes('gauntlet-wrapper') && h.command.includes('notify.mjs'));
}

async function readJson(path: string): Promise<ClaudeSettingsFile> {
  try {
    return JSON.parse(await readFile(path, 'utf8')) as ClaudeSettingsFile;
  } catch {
    return {};
  }
}

export async function installNotificationHook(projectId: string, projectPath: string): Promise<HookInstallTarget> {
  const target: HookInstallTarget = (await isSettingsJsonTracked(projectPath)) ? 'settings.local.json' : 'settings.json';
  const claudeDir = join(projectPath, '.claude');
  const filePath = join(claudeDir, target);

  await mkdir(claudeDir, { recursive: true });
  const settings = await readJson(filePath);
  settings.hooks ??= {};
  const notificationHooks = (settings.hooks.Notification ??= []);

  const ourEntry: HookEntry = { matcher: '', hooks: [{ type: 'command', command: buildHookCommand(projectId) }] };
  const existingIdx = notificationHooks.findIndex(isOurEntry);
  if (existingIdx !== -1) {
    notificationHooks[existingIdx] = ourEntry;
  } else {
    notificationHooks.push(ourEntry);
  }

  await writeFile(filePath, JSON.stringify(settings, null, 2), 'utf8');
  return target;
}
