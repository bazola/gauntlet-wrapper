import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname } from 'node:path';
import { SETTINGS_FILE } from './paths.js';

export interface WrapperSettings {
  defaultReviewerModel: string;
}

const DEFAULTS: WrapperSettings = { defaultReviewerModel: 'opus' };

export async function readSettings(): Promise<WrapperSettings> {
  try {
    const raw = await readFile(SETTINGS_FILE, 'utf8');
    return { ...DEFAULTS, ...(JSON.parse(raw) as Partial<WrapperSettings>) };
  } catch {
    return { ...DEFAULTS };
  }
}

export async function writeSettings(patch: Partial<WrapperSettings>): Promise<WrapperSettings> {
  const next = { ...(await readSettings()), ...patch };
  await mkdir(dirname(SETTINGS_FILE), { recursive: true });
  await writeFile(SETTINGS_FILE, JSON.stringify(next, null, 2), 'utf8');
  return next;
}
