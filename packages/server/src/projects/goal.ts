import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';

export interface GoalHistoryEntry {
  version: number;
  editedAt: string;
  editedBy: 'user' | 'claude-discovery-draft';
  note?: string;
}

export interface GoalMeta {
  schemaVersion: 1;
  currentVersion: number;
  history: GoalHistoryEntry[];
}

function goalPath(projectPath: string): string {
  return join(projectPath, '.gauntlet', 'goal.md');
}
function metaPath(projectPath: string): string {
  return join(projectPath, '.gauntlet', 'goal.meta.json');
}
function historyPath(projectPath: string, version: number): string {
  return join(projectPath, '.gauntlet', 'goal-history', `v${version}.md`);
}

function emptyMeta(): GoalMeta {
  return { schemaVersion: 1, currentVersion: 0, history: [] };
}

export async function readGoal(projectPath: string): Promise<{ text: string; meta: GoalMeta }> {
  const [text, metaRaw] = await Promise.all([
    readFile(goalPath(projectPath), 'utf8').catch(() => ''),
    readFile(metaPath(projectPath), 'utf8').catch(() => null),
  ]);
  const meta: GoalMeta = metaRaw ? (JSON.parse(metaRaw) as GoalMeta) : emptyMeta();
  return { text, meta };
}

// Snapshots the text being replaced under its own version number before
// overwriting goal.md, so every past version stays readable from
// goal-history/ while goal.md always holds only the live one -- that's what
// lets a generation record stay interpretable against "goal as of vN" without
// needing frontmatter inside goal.md itself.
export async function writeGoal(projectPath: string, text: string): Promise<{ text: string; meta: GoalMeta }> {
  const { text: prevText, meta } = await readGoal(projectPath);
  const nextVersion = meta.currentVersion + 1;

  await mkdir(join(projectPath, '.gauntlet', 'goal-history'), { recursive: true });
  if (prevText.trim().length > 0) {
    await writeFile(historyPath(projectPath, meta.currentVersion), prevText, 'utf8');
  }

  const nextMeta: GoalMeta = {
    schemaVersion: 1,
    currentVersion: nextVersion,
    history: [...meta.history, { version: nextVersion, editedAt: new Date().toISOString(), editedBy: 'user' }],
  };

  await writeFile(goalPath(projectPath), text, 'utf8');
  await writeFile(metaPath(projectPath), JSON.stringify(nextMeta, null, 2), 'utf8');

  return { text, meta: nextMeta };
}
