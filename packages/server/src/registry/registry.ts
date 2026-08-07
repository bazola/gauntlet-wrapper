import { randomUUID } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import type { ProjectRegistryEntry } from '@gauntlet-wrapper/shared';
import { REGISTRY_FILE } from '../config/paths.js';

async function readRegistry(): Promise<ProjectRegistryEntry[]> {
  let raw: string;
  try {
    raw = await readFile(REGISTRY_FILE, 'utf8');
  } catch (err: any) {
    if (err.code === 'ENOENT') return [];
    throw err;
  }
  try {
    return JSON.parse(raw) as ProjectRegistryEntry[];
  } catch (err) {
    // A hand-edited or corrupted registry file must not crash the whole
    // server (it did, once, during development) -- surface it loudly instead
    // and degrade to "no projects" rather than losing every terminal session.
    console.error(`[gauntlet-wrapper] ${REGISTRY_FILE} is not valid JSON, treating as empty:`, err);
    return [];
  }
}

async function writeRegistry(entries: ProjectRegistryEntry[]): Promise<void> {
  await mkdir(dirname(REGISTRY_FILE), { recursive: true });
  await writeFile(REGISTRY_FILE, JSON.stringify(entries, null, 2), 'utf8');
}

export async function listProjects(): Promise<ProjectRegistryEntry[]> {
  return readRegistry();
}

export async function getProject(id: string): Promise<ProjectRegistryEntry | undefined> {
  const entries = await readRegistry();
  return entries.find((e) => e.id === id);
}

export async function addProject(path: string, displayName?: string): Promise<ProjectRegistryEntry> {
  const absPath = resolve(path);
  const entries = await readRegistry();
  const existing = entries.find((e) => resolve(e.path) === absPath);
  if (existing) return existing;

  const entry: ProjectRegistryEntry = {
    id: randomUUID(),
    path: absPath,
    displayName: displayName?.trim() || absPath.split(/[\\/]/).pop() || absPath,
    createdAt: new Date().toISOString(),
  };
  entries.push(entry);
  await writeRegistry(entries);
  return entry;
}

export async function removeProject(id: string): Promise<boolean> {
  const entries = await readRegistry();
  const next = entries.filter((e) => e.id !== id);
  if (next.length === entries.length) return false;
  await writeRegistry(next);
  return true;
}
