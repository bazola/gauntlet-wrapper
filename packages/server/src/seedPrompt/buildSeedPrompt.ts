import { readFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { GauntletConfig } from '@gauntlet-wrapper/shared';
import { readGoal } from '../projects/goal.js';

// packages/server/{src,dist}/seedPrompt -> repo root is 4 levels up regardless
// of whether this runs from src (tsx) or dist (tsc) -- same nesting depth.
const TEMPLATES_DIR = join(dirname(fileURLToPath(import.meta.url)), '../../../../templates', 'seed-prompt');

function render(template: string, vars: Record<string, string>): string {
  return template.replace(/\{\{(\w+)\}\}/g, (_match, key: string) => vars[key] ?? `{{${key}}}`);
}

// A best-effort guess only -- surfaced in the kickoff prompt as a hint, never
// treated as authoritative. Claude's own discovery phase (KICKOFF S1) decides
// the real projectType and writes it back to config.json.
async function guessProjectTypeHint(projectPath: string): Promise<string> {
  try {
    const raw = await readFile(join(projectPath, 'package.json'), 'utf8');
    const pkg = JSON.parse(raw) as {
      dependencies?: Record<string, string>;
      devDependencies?: Record<string, string>;
      bin?: unknown;
      main?: string;
    };
    const names = Object.keys({ ...pkg.dependencies, ...pkg.devDependencies });
    const suffix = '(heuristic guess only -- your own discovery decides)';
    if (names.some((n) => /webgpu/i.test(n))) return `possibly browser-webgpu ${suffix}`;
    if (pkg.bin || names.some((n) => ['commander', 'yargs', 'clipanion'].includes(n))) {
      return `possibly cli ${suffix}`;
    }
    if (names.some((n) => ['express', 'fastify', 'koa', '@nestjs/core'].includes(n))) {
      return `possibly backend-service ${suffix}`;
    }
    if (names.some((n) => ['vite', 'react', 'three'].includes(n))) {
      return `possibly browser-canvas ${suffix}`;
    }
    if (pkg.main && !pkg.bin) return `possibly library ${suffix}`;
  } catch {
    // no package.json, or not an npm project -- no heuristic signal available
  }
  return 'no heuristic signal found -- your own discovery decides';
}

export async function buildKickoffPrompt(projectPath: string, config: GauntletConfig): Promise<string> {
  const [template, perfSchema, goal, typeHint] = await Promise.all([
    readFile(join(TEMPLATES_DIR, 'KICKOFF.md.tmpl'), 'utf8'),
    readFile(join(TEMPLATES_DIR, 'PERF_CONTRACT_SCHEMA.md'), 'utf8'),
    readGoal(projectPath),
    guessProjectTypeHint(projectPath),
  ]);

  const goalText =
    goal.text.trim().length > 0
      ? goal.text
      : '_(no goal set yet -- ask the human to fill in `.gauntlet/goal.md` via the wrapper Config tab before committing to a direction)_';

  return render(template, {
    PROJECT_DISPLAY_NAME: config.displayName,
    GOAL_MD_CONTENTS: goalText,
    REVIEWER_MODEL: config.reviewerModel,
    PROJECT_TYPE_HINT: typeHint,
    PERF_CONTRACT_SCHEMA: perfSchema,
  });
}

export async function buildResumeNote(
  projectPath: string,
  config: GauntletConfig,
  currentGeneration: number,
): Promise<string> {
  void projectPath; // not needed yet, kept for signature symmetry with buildKickoffPrompt
  const template = await readFile(join(TEMPLATES_DIR, 'RESUME_NOTE.md.tmpl'), 'utf8');
  return render(template, {
    PROJECT_DISPLAY_NAME: config.displayName,
    CURRENT_GENERATION: String(currentGeneration),
  });
}
