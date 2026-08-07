import { randomUUID } from 'node:crypto';
import { mkdir, readFile, writeFile, rm } from 'node:fs/promises';
import { join } from 'node:path';
import type { ReferencesCatalog, PhotoReference, VideoReference, GameplayReference } from '@gauntlet-wrapper/shared';
import { readCurrentGeneration as currentGeneration } from '../progress/currentGeneration.js';

function catalogPath(projectPath: string): string {
  return join(projectPath, '.gauntlet', 'references', 'catalog.json');
}

function emptyCatalog(): ReferencesCatalog {
  return { schemaVersion: 1, photo: [], video: [], gameplay: [] };
}

export async function readCatalog(projectPath: string): Promise<ReferencesCatalog> {
  try {
    const raw = await readFile(catalogPath(projectPath), 'utf8');
    return JSON.parse(raw) as ReferencesCatalog;
  } catch {
    return emptyCatalog();
  }
}

async function writeCatalog(projectPath: string, catalog: ReferencesCatalog): Promise<void> {
  await mkdir(join(projectPath, '.gauntlet', 'references'), { recursive: true });
  await writeFile(catalogPath(projectPath), JSON.stringify(catalog, null, 2), 'utf8');
}

// `id` must be the same id the upload route already used as the destination
// folder name (see newReferenceId()), so the catalog entry and the file on
// disk agree on where to find each other.
export async function addPhotoReference(
  projectPath: string,
  id: string,
  filename: string,
  note: string,
): Promise<PhotoReference> {
  const catalog = await readCatalog(projectPath);
  const entry: PhotoReference = {
    id,
    type: 'photo',
    filename,
    note,
    addedAt: new Date().toISOString(),
    addedAtGeneration: await currentGeneration(projectPath),
    derived: { processed: false, tags: [] },
  };
  catalog.photo.push(entry);
  await writeCatalog(projectPath, catalog);
  return entry;
}

export async function addVideoReference(
  projectPath: string,
  id: string,
  filename: string,
  note: string,
): Promise<VideoReference> {
  const catalog = await readCatalog(projectPath);
  const entry: VideoReference = {
    id,
    type: 'video',
    filename,
    note,
    addedAt: new Date().toISOString(),
    addedAtGeneration: await currentGeneration(projectPath),
    derived: { processed: false, stripCount: 0 },
  };
  catalog.video.push(entry);
  await writeCatalog(projectPath, catalog);
  return entry;
}

export async function addGameplayReference(
  projectPath: string,
  goalText: string,
  gapText: string,
  testIdeasText: string,
): Promise<GameplayReference> {
  const catalog = await readCatalog(projectPath);
  const entry: GameplayReference = {
    id: randomUUID(),
    type: 'gameplay',
    goalText,
    gapText,
    testIdeasText,
    addedAt: new Date().toISOString(),
    addedAtGeneration: await currentGeneration(projectPath),
    status: 'raw',
    formalizedAt: null,
    derivedRequirementIds: [],
  };
  catalog.gameplay.push(entry);
  await writeCatalog(projectPath, catalog);
  return entry;
}

// Pre-allocates the id a photo/video upload will use, so multer's destination
// callback (which needs a directory before the upload finishes) and the
// catalog entry we write afterward agree on the same folder name.
export function newReferenceId(): string {
  return randomUUID();
}

export async function removePhotoReference(projectPath: string, id: string): Promise<boolean> {
  const catalog = await readCatalog(projectPath);
  const idx = catalog.photo.findIndex((r) => r.id === id);
  if (idx === -1) return false;
  catalog.photo.splice(idx, 1);
  await writeCatalog(projectPath, catalog);
  await rm(join(projectPath, '.gauntlet', 'references', 'photo', id), { recursive: true, force: true });
  return true;
}

export async function removeVideoReference(projectPath: string, id: string): Promise<boolean> {
  const catalog = await readCatalog(projectPath);
  const idx = catalog.video.findIndex((r) => r.id === id);
  if (idx === -1) return false;
  catalog.video.splice(idx, 1);
  await writeCatalog(projectPath, catalog);
  await rm(join(projectPath, '.gauntlet', 'references', 'video', id), { recursive: true, force: true });
  return true;
}

export async function removeGameplayReference(projectPath: string, id: string): Promise<boolean> {
  const catalog = await readCatalog(projectPath);
  const idx = catalog.gameplay.findIndex((r) => r.id === id);
  if (idx === -1) return false;
  // No files on disk for a gameplay reference -- catalog entry is all there is.
  // NB: if it was already formalized (derivedRequirementIds non-empty), the
  // requirements it produced are left standing -- there's no formalization
  // pipeline yet to know whether retiring them is safe.
  catalog.gameplay.splice(idx, 1);
  await writeCatalog(projectPath, catalog);
  return true;
}
