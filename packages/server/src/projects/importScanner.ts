import { readFile, readdir, stat } from 'node:fs/promises';
import { join, relative, extname } from 'node:path';
import type { ImportScanResult, ImportCandidateMedia, ImportCandidateGoal, ImportCandidateGeneration } from '@gauntlet-wrapper/shared';
import { readDerivedCatalogHints, normalizeSlashes } from './derivedCatalogHints.js';

const PHOTO_EXTENSIONS = new Set(['.png', '.jpg', '.jpeg', '.gif', '.webp', '.bmp', '.tiff']);
const VIDEO_EXTENSIONS = new Set(['.mp4', '.mov', '.webm', '.avi', '.mkv', '.m4v']);

// Shallow (non-recursive) candidate directories only -- deliberately not
// walking the whole tree, both to stay fast and to avoid sweeping up
// already-preprocessed derivative assets (e.g. a references/derived/ folder
// full of extracted frames) alongside the original raw material.
const MEDIA_CANDIDATE_DIRS = ['references', 'reference', 'refs', 'assets/references', '.'];

const MAX_CANDIDATES_PER_TYPE = 300;

// Priority order: the first of these that exists wins. Narrow and
// heuristic on purpose -- extend this list as more real-world project
// layouts get tested against it, rather than guessing broadly up front.
const GOAL_FILE_CANDIDATES = ['GAUNTLET_PROMPT.md', 'PROMPT.md', 'KICKOFF.md', 'GOAL.md', 'PRD.md', 'DESIGN.md', 'README.md'];

const GOAL_PREVIEW_CHARS = 3000;

async function scanMediaDir(projectPath: string, relDir: string, notes: string[]): Promise<{ photos: ImportCandidateMedia[]; videos: ImportCandidateMedia[] }> {
  const absDir = join(projectPath, relDir);
  let entries;
  try {
    entries = await readdir(absDir, { withFileTypes: true });
  } catch {
    return { photos: [], videos: [] }; // directory doesn't exist -- not an error, just nothing here
  }

  const photos: ImportCandidateMedia[] = [];
  const videos: ImportCandidateMedia[] = [];

  for (const entry of entries) {
    if (!entry.isFile()) continue;
    const ext = extname(entry.name).toLowerCase();
    if (!PHOTO_EXTENSIONS.has(ext) && !VIDEO_EXTENSIONS.has(ext)) continue;

    const absPath = join(absDir, entry.name);
    const st = await stat(absPath);
    const candidate: ImportCandidateMedia = {
      sourcePath: absPath,
      relativePath: relative(projectPath, absPath),
      filename: entry.name,
      sizeBytes: st.size,
      suggestedNote: '',
    };

    if (PHOTO_EXTENSIONS.has(ext)) photos.push(candidate);
    else videos.push(candidate);
  }

  return { photos, videos };
}

async function findGoalCandidate(projectPath: string): Promise<ImportCandidateGoal | null> {
  for (const filename of GOAL_FILE_CANDIDATES) {
    try {
      const content = await readFile(join(projectPath, filename), 'utf8');
      return {
        sourceFile: filename,
        preview: content.slice(0, GOAL_PREVIEW_CHARS),
        fullLength: content.length,
      };
    } catch {
      continue;
    }
  }
  return null;
}

function summarizeUnknownProgress(obj: unknown): string {
  if (obj && typeof obj === 'object') {
    const record = obj as Record<string, unknown>;
    const parts: string[] = [];
    if (typeof record.wave === 'string') parts.push(`Wave: ${record.wave}`);
    if (typeof record.statusNote === 'string') parts.push(record.statusNote);
    else if (typeof record.summary === 'string') parts.push(record.summary);
    else if (typeof record.status === 'string') parts.push(record.status);
    if (parts.length > 0) return parts.join(' -- ').slice(0, 2000);
  }
  return JSON.stringify(obj).slice(0, 1000);
}

async function findGenerationCandidate(projectPath: string, notes: string[]): Promise<ImportCandidateGeneration | null> {
  const relFile = join('progress', 'state.json');
  try {
    const raw = await readFile(join(projectPath, relFile), 'utf8');
    const parsed = JSON.parse(raw);
    notes.push(
      'progress/state.json looks like a single mutable status doc, not per-round history -- it will import as ONE baseline snapshot, not a reconstructed timeline.',
    );
    return { sourceFile: relFile, summary: summarizeUnknownProgress(parsed) };
  } catch {
    return null;
  }
}

export async function scanForImportCandidates(projectPath: string): Promise<ImportScanResult> {
  const notes: string[] = [];
  const allPhotos: ImportCandidateMedia[] = [];
  const allVideos: ImportCandidateMedia[] = [];
  const seenPaths = new Set<string>();

  for (const dir of MEDIA_CANDIDATE_DIRS) {
    const { photos, videos } = await scanMediaDir(projectPath, dir, notes);
    for (const p of photos) {
      if (!seenPaths.has(p.sourcePath)) {
        seenPaths.add(p.sourcePath);
        allPhotos.push(p);
      }
    }
    for (const v of videos) {
      if (!seenPaths.has(v.sourcePath)) {
        seenPaths.add(v.sourcePath);
        allVideos.push(v);
      }
    }
  }

  const hints = await readDerivedCatalogHints(projectPath, MEDIA_CANDIDATE_DIRS);
  let matchedHints = 0;
  for (const p of allPhotos) {
    const tags = hints.photoTagsBySourceFilename.get(p.filename);
    if (tags) {
      p.suggestedNote = tags;
      matchedHints++;
    }
  }
  for (const v of allVideos) {
    const note = hints.videoNotesByRelativePath.get(normalizeSlashes(v.relativePath));
    if (note) {
      v.suggestedNote = note;
      matchedHints++;
    }
  }
  if (matchedHints > 0) {
    notes.push(`Found a references/derived/catalog.json-style preprocessing catalog -- pulled in notes for ${matchedHints} file(s).`);
  }

  let photos = allPhotos;
  let videos = allVideos;
  if (photos.length > MAX_CANDIDATES_PER_TYPE) {
    notes.push(`Found ${photos.length} candidate photos, showing the first ${MAX_CANDIDATES_PER_TYPE}.`);
    photos = photos.slice(0, MAX_CANDIDATES_PER_TYPE);
  }
  if (videos.length > MAX_CANDIDATES_PER_TYPE) {
    notes.push(`Found ${videos.length} candidate videos, showing the first ${MAX_CANDIDATES_PER_TYPE}.`);
    videos = videos.slice(0, MAX_CANDIDATES_PER_TYPE);
  }

  const goal = await findGoalCandidate(projectPath);
  const generation = await findGenerationCandidate(projectPath, notes);

  return { photos, videos, goal, generation, notes };
}
