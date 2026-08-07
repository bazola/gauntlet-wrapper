import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { ProgressStateSchema } from '@gauntlet-wrapper/shared';

// Reads the current generation straight off progress/state.json (Claude-owned,
// see onboarding.ts and the KICKOFF template's S7). Used anywhere something
// needs to stamp "as of this generation" -- reference additions, resume notes.
export async function readCurrentGeneration(projectPath: string): Promise<number | null> {
  try {
    const raw = await readFile(join(projectPath, '.gauntlet', 'progress', 'state.json'), 'utf8');
    const result = ProgressStateSchema.safeParse(JSON.parse(raw));
    return result.success ? result.data.currentGeneration : null;
  } catch {
    return null;
  }
}
