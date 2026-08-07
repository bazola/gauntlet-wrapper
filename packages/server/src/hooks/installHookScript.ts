import { mkdir, copyFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { HOOK_SCRIPTS_DIR } from '../config/paths.js';

// Canonical source lives in the wrapper repo itself; installed into the
// stable ~/.gauntlet-wrapper/hook-scripts/ location so hook commands baked
// into any number of target repos keep working even if this repo checkout
// moves or gets deleted. Same depth-from-module trick as TEMPLATES_DIR.
const SOURCE_DIR = join(dirname(fileURLToPath(import.meta.url)), '../../../../hook-scripts');

export async function ensureHookScriptInstalled(): Promise<void> {
  await mkdir(HOOK_SCRIPTS_DIR, { recursive: true });
  await copyFile(join(SOURCE_DIR, 'notify.mjs'), join(HOOK_SCRIPTS_DIR, 'notify.mjs'));
}
