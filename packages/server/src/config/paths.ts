import { homedir } from 'node:os';
import { join } from 'node:path';

// ~/.gauntlet-wrapper — home for the global project registry + wrapper settings.
// Per-project config/goal/progress live only inside each target repo's own
// .gauntlet/ directory (see packages/server/src/projects/onboarding.ts); this
// is wrapper-global state only (which repos are registered, default reviewer
// model, the fixed hook-webhook port).
export const WRAPPER_HOME = join(homedir(), '.gauntlet-wrapper');
export const REGISTRY_FILE = join(WRAPPER_HOME, 'registry.json');
export const SETTINGS_FILE = join(WRAPPER_HOME, 'settings.json');
export const HOOK_SCRIPTS_DIR = join(WRAPPER_HOME, 'hook-scripts');
