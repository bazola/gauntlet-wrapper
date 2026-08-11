import { readFile, readdir } from 'node:fs/promises';
import { join } from 'node:path';
import type { z } from 'zod';
import {
  ProgressStateSchema,
  RequirementsFileSchema,
  GenerationRecordSchema,
  type ProgressState,
  type RequirementsFile,
  type GenerationRecord,
  type ProgressSnapshot,
} from '@gauntlet-wrapper/shared';

// Defensive by construction: Claude owns every file under here (see the
// KICKOFF template's S7), so a missing file just means "nothing written yet"
// (not an error) and a malformed one (mid-write, or genuinely wrong shape)
// gets surfaced in `errors` rather than throwing and blanking the whole tab.
async function readJsonSafe<T>(path: string, schema: z.ZodType<T>, errors: string[], label: string): Promise<T | null> {
  let raw: string;
  try {
    raw = await readFile(path, 'utf8');
  } catch {
    return null;
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch (err) {
    errors.push(`${label}: invalid JSON (${err instanceof Error ? err.message : String(err)})`);
    return null;
  }

  const result = schema.safeParse(parsed);
  if (!result.success) {
    // Zod's own issue.message is often just "Required" with no field name --
    // the path is where the actually useful information lives, so it's
    // prepended here rather than left for the reader to guess at.
    const detail = result.error.issues.map((i) => `${i.path.join('.') || '(root)'}: ${i.message}`).join('; ');
    errors.push(`${label}: schema validation failed (${detail})`);
    return null;
  }
  return result.data;
}

// Standalone so callers that only need the standing requirement set (e.g. the
// References tab cross-referencing a gameplay reference's derivedRequirementIds)
// don't have to pull in generations/state through the full snapshot.
export async function readRequirementsFile(projectPath: string): Promise<RequirementsFile | null> {
  const errors: string[] = [];
  return readJsonSafe(
    join(projectPath, '.gauntlet', 'progress', 'requirements.json'),
    RequirementsFileSchema,
    errors,
    'requirements.json',
  );
}

export async function readProgressSnapshot(projectPath: string): Promise<ProgressSnapshot> {
  const errors: string[] = [];
  const progressDir = join(projectPath, '.gauntlet', 'progress');

  const state: ProgressState | null = await readJsonSafe(join(progressDir, 'state.json'), ProgressStateSchema, errors, 'state.json');
  const requirements: RequirementsFile | null = await readJsonSafe(
    join(progressDir, 'requirements.json'),
    RequirementsFileSchema,
    errors,
    'requirements.json',
  );

  const generationsDir = join(progressDir, 'generations');
  let files: string[] = [];
  try {
    files = (await readdir(generationsDir)).filter((f) => f.endsWith('.json'));
  } catch {
    // no generations directory yet -- fine, nothing recorded so far
  }

  const generations: GenerationRecord[] = [];
  for (const file of files.sort()) {
    const record = await readJsonSafe(join(generationsDir, file), GenerationRecordSchema, errors, `generations/${file}`);
    if (record) generations.push(record);
  }
  generations.sort((a, b) => a.generation - b.generation);

  return { state, requirements, generations, errors };
}
