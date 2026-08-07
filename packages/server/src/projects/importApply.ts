import { randomUUID } from 'node:crypto';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { copyFile, mkdir, readFile, writeFile } from 'node:fs/promises';
import { basename, join } from 'node:path';
import type { ImportApplyRequest, ImportApplyResult, GenerationRecord, ProgressState } from '@gauntlet-wrapper/shared';
import { addPhotoReference, addVideoReference } from '../references/referenceCatalog.js';
import { writeGoal } from './goal.js';
import { setGoalSummary } from './configStore.js';
import { readProgressSnapshot } from '../progress/progressReader.js';
import { scanForImportCandidates } from './importScanner.js';

const execFileAsync = promisify(execFile);

async function getGitState(projectPath: string): Promise<{ sha: string | null; dirty: boolean }> {
  try {
    const [{ stdout: shaOut }, { stdout: statusOut }] = await Promise.all([
      execFileAsync('git', ['rev-parse', 'HEAD'], { cwd: projectPath }),
      execFileAsync('git', ['status', '--porcelain'], { cwd: projectPath }),
    ]);
    const dirty = statusOut.trim().length > 0;
    return { sha: dirty ? null : shaOut.trim(), dirty };
  } catch {
    return { sha: null, dirty: false }; // not a git repo, or git unavailable
  }
}

async function importMediaFile(projectPath: string, kind: 'photo' | 'video', sourcePath: string, note: string): Promise<void> {
  const id = randomUUID();
  const filename = basename(sourcePath);
  const destDir = join(projectPath, '.gauntlet', 'references', kind, id);
  await mkdir(destDir, { recursive: true });
  await copyFile(sourcePath, join(destDir, filename));

  // Whatever note text the client sent (the scan's suggested note, possibly
  // user-edited) is written verbatim; only fall back to a generic note if it
  // was left blank -- no tags/notes found, or the user cleared it on purpose.
  const finalNote = note.trim().length > 0 ? note : `Imported from ${filename}`;
  if (kind === 'photo') await addPhotoReference(projectPath, id, filename, finalNote);
  else await addVideoReference(projectPath, id, filename, finalNote);
}

export async function applyImport(projectPath: string, request: ImportApplyRequest): Promise<ImportApplyResult> {
  let photosImported = 0;
  let videosImported = 0;

  for (const { sourcePath, note } of request.photos) {
    await importMediaFile(projectPath, 'photo', sourcePath, note);
    photosImported++;
  }
  for (const { sourcePath, note } of request.videos) {
    await importMediaFile(projectPath, 'video', sourcePath, note);
    videosImported++;
  }

  let goalImported = false;
  let generationImported = false;

  if (request.importGoal || request.importGeneration) {
    const scan = await scanForImportCandidates(projectPath);

    if (request.importGoal && scan.goal) {
      const fullContent = await readFile(join(projectPath, scan.goal.sourceFile), 'utf8');
      await writeGoal(projectPath, fullContent);
      const summary =
        fullContent
          .split('\n')
          .map((line) => line.replace(/^#+\s*/, '').trim())
          .find((line) => line.length > 0)
          ?.slice(0, 140) ?? '';
      await setGoalSummary(projectPath, summary);
      goalImported = true;
    }

    if (request.importGeneration && scan.generation) {
      const [snapshot, git] = await Promise.all([readProgressSnapshot(projectPath), getGitState(projectPath)]);
      const nextGen = snapshot.generations.length > 0 ? Math.max(...snapshot.generations.map((g) => g.generation)) + 1 : 1;

      const record: GenerationRecord = {
        schemaVersion: 1,
        generation: nextGen,
        label: 'imported-baseline',
        createdAt: new Date().toISOString(),
        gitSha: git.sha,
        gitDirty: git.dirty,
        statusNote: `Imported baseline snapshot from ${scan.generation.sourceFile}: ${scan.generation.summary}`,
        performanceGate: {
          evaluated: false,
          pass: false,
          evidence: [],
          reason: 'imported baseline -- not measured by gauntlet-wrapper, no fresh evidence exists yet',
        },
        lanes: [],
        failingRequirementIds: [],
      };

      const generationsDir = join(projectPath, '.gauntlet', 'progress', 'generations');
      await mkdir(generationsDir, { recursive: true });
      await writeFile(join(generationsDir, `gen-${String(nextGen).padStart(4, '0')}.json`), JSON.stringify(record, null, 2), 'utf8');

      const statePath = join(projectPath, '.gauntlet', 'progress', 'state.json');
      let state: ProgressState;
      try {
        state = JSON.parse(await readFile(statePath, 'utf8')) as ProgressState;
      } catch {
        state = { schemaVersion: 1, currentGeneration: 0, activeLanes: [], reviewerModel: 'opus', lastUpdatedAt: new Date().toISOString() };
      }
      state.currentGeneration = nextGen;
      state.lastUpdatedAt = new Date().toISOString();
      await writeFile(statePath, JSON.stringify(state, null, 2), 'utf8');

      generationImported = true;
    }
  }

  return { photosImported, videosImported, goalImported, generationImported };
}
