import { readFile } from 'node:fs/promises';
import { join, extname, basename } from 'node:path';

export interface DerivedCatalogHints {
  /** Raw filename (e.g. "001.jpg") -> comma-joined content tags. */
  photoTagsBySourceFilename: Map<string, string>;
  /** Forward-slash-normalized relative path -> note text. */
  videoNotesByRelativePath: Map<string, string>;
}

function normalizeSlashes(p: string): string {
  return p.replace(/\\/g, '/');
}

function normalizeToken(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9]/g, '');
}

// Strips a common "gameplay_"/"gameplay-" prefix and the extension, then
// normalizes to bare alphanumerics, so "gameplay_horizontalSlash.mp4" and a
// catalog strip's action field "horizontal_slash" compare equal.
function videoStemToken(filename: string): string {
  const stem = basename(filename, extname(filename)).replace(/^gameplay[-_]/i, '');
  return normalizeToken(stem);
}

async function readOneDerivedCatalog(catalogPath: string): Promise<DerivedCatalogHints | null> {
  let parsed: unknown;
  try {
    parsed = JSON.parse(await readFile(catalogPath, 'utf8'));
  } catch {
    return null;
  }
  if (!parsed || typeof parsed !== 'object') return null;
  const obj = parsed as Record<string, unknown>;

  const photoTagsBySourceFilename = new Map<string, string>();
  if (Array.isArray(obj.stills)) {
    for (const entry of obj.stills) {
      if (!entry || typeof entry !== 'object') continue;
      const e = entry as Record<string, unknown>;
      const source = typeof e.source === 'string' ? e.source : null;
      const tags = Array.isArray(e.tags) ? e.tags.filter((t): t is string => typeof t === 'string') : [];
      if (source && tags.length > 0 && !photoTagsBySourceFilename.has(source)) {
        photoTagsBySourceFilename.set(source, tags.join(', '));
      }
    }
  }

  const videoNotesByRelativePath = new Map<string, string>();
  if (Array.isArray(obj.sourceVideos)) {
    for (const entry of obj.sourceVideos) {
      if (!entry || typeof entry !== 'object') continue;
      const e = entry as Record<string, unknown>;
      const file = typeof e.file === 'string' ? normalizeSlashes(e.file) : null;
      if (!file) continue;
      const parts: string[] = [];
      if (typeof e.resolution === 'string') parts.push(e.resolution);
      if (typeof e.fps === 'number') parts.push(`${e.fps}fps`);
      if (typeof e.durationSeconds === 'number') parts.push(`${e.durationSeconds}s`);
      if (parts.length > 0) videoNotesByRelativePath.set(file, parts.join(' @ '));
    }
  }

  // Best-effort enrichment: a strip's `action` name usually matches its
  // source video's filename stem. This isn't a one-off gauntlet-zelda
  // special case -- the wrapper's own kickoff template (S4) asks Claude to
  // preprocess references into exactly this derived/ catalog shape, so any
  // project that's been through a wrapper-guided reference pass is likely to
  // produce a catalog like this over time.
  if (Array.isArray(obj.strips) && Array.isArray(obj.sourceVideos)) {
    const stripTextByToken = new Map<string, string[]>();
    for (const entry of obj.strips) {
      if (!entry || typeof entry !== 'object') continue;
      const e = entry as Record<string, unknown>;
      const action = typeof e.action === 'string' ? e.action : null;
      if (!action) continue;
      const token = normalizeToken(action);
      const text = typeof e.notes === 'string' && e.notes.length > 0 ? e.notes : action;
      const list = stripTextByToken.get(token) ?? [];
      list.push(text);
      stripTextByToken.set(token, list);
    }

    for (const entry of obj.sourceVideos) {
      if (!entry || typeof entry !== 'object') continue;
      const e = entry as Record<string, unknown>;
      const file = typeof e.file === 'string' ? normalizeSlashes(e.file) : null;
      if (!file) continue;
      const matches = stripTextByToken.get(videoStemToken(file));
      if (!matches || matches.length === 0) continue;
      const stripText = matches.join(' / ').slice(0, 500);
      const existing = videoNotesByRelativePath.get(file);
      videoNotesByRelativePath.set(file, existing ? `${existing} -- ${stripText}` : stripText);
    }
  }

  return { photoTagsBySourceFilename, videoNotesByRelativePath };
}

// Checked under the same shallow candidate directories used for raw media
// discovery (references/derived/catalog.json is the exact shape EVIDENCE.md
// -style preprocessing produces). Merges hints from every candidate found;
// first match per key wins.
export async function readDerivedCatalogHints(projectPath: string, candidateDirs: string[]): Promise<DerivedCatalogHints> {
  const merged: DerivedCatalogHints = { photoTagsBySourceFilename: new Map(), videoNotesByRelativePath: new Map() };
  for (const dir of candidateDirs) {
    const hints = await readOneDerivedCatalog(join(projectPath, dir, 'derived', 'catalog.json'));
    if (!hints) continue;
    for (const [k, v] of hints.photoTagsBySourceFilename) {
      if (!merged.photoTagsBySourceFilename.has(k)) merged.photoTagsBySourceFilename.set(k, v);
    }
    for (const [k, v] of hints.videoNotesByRelativePath) {
      if (!merged.videoNotesByRelativePath.has(k)) merged.videoNotesByRelativePath.set(k, v);
    }
  }
  return merged;
}

export { normalizeSlashes };
