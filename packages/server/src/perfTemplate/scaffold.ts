import { mkdir, readdir, readFile, writeFile, access } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

// Canonical source lives in the wrapper repo itself, same depth-from-module
// trick as TEMPLATES_DIR in seedPrompt/buildSeedPrompt.ts.
const SOURCE_DIR = join(dirname(fileURLToPath(import.meta.url)), '../../../../templates', 'perf-harness-starter');

async function exists(path: string): Promise<boolean> {
  try {
    await access(path);
    return true;
  } catch {
    return false;
  }
}

// Idempotent, same pattern as onboarding.ts: never overwrites a file that's
// already there (a project may have already started customizing it).
async function copyDirRecursive(srcDir: string, destDir: string, copiedFiles: string[]): Promise<void> {
  await mkdir(destDir, { recursive: true });
  const entries = await readdir(srcDir, { withFileTypes: true });
  for (const entry of entries) {
    const srcPath = join(srcDir, entry.name);
    const destPath = join(destDir, entry.name);
    if (entry.isDirectory()) {
      await copyDirRecursive(srcPath, destPath, copiedFiles);
      continue;
    }
    if (await exists(destPath)) continue;
    await writeFile(destPath, await readFile(srcPath));
    copiedFiles.push(destPath);
  }
}

export interface ScaffoldPerfHarnessResult {
  copiedFiles: string[];
  alreadyPresent: boolean;
}

export async function scaffoldPerfHarness(projectPath: string): Promise<ScaffoldPerfHarnessResult> {
  const destHarnessDir = join(projectPath, 'harness');
  const alreadyPresent = await exists(join(destHarnessDir, 'run-perf.ts'));
  const copiedFiles: string[] = [];

  await copyDirRecursive(join(SOURCE_DIR, 'harness'), destHarnessDir, copiedFiles);

  // README + package.json snippet live inside harness/ too, kept clearly
  // separate from the project's own root-level README/package.json.
  for (const file of ['README.md', 'package.json.snippet.json']) {
    const destPath = join(destHarnessDir, file);
    if (await exists(destPath)) continue;
    await writeFile(destPath, await readFile(join(SOURCE_DIR, file)));
    copiedFiles.push(destPath);
  }

  return { copiedFiles, alreadyPresent };
}
