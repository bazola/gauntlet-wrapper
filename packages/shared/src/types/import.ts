// Best-effort scan of an existing (possibly years-old) target repo, looking
// for things worth porting into the .gauntlet/ contract. Nothing here is
// written until the user reviews the preview and calls apply with their
// selections -- see ImportApplyRequest.

export interface ImportCandidateMedia {
  /** Absolute path on disk, relative to nothing -- used only server-side to apply. */
  sourcePath: string;
  /** Path relative to the project root, for display. */
  relativePath: string;
  filename: string;
  sizeBytes: number;
}

export interface ImportCandidateGoal {
  sourceFile: string; // relative path, e.g. "GAUNTLET_PROMPT.md"
  preview: string; // truncated content for display
  fullLength: number;
}

// Only ever a single synthetic baseline -- gauntlet-zelda-style progress data
// is a mutable "current status" doc, not per-round history, so this is
// honestly labeled as one imported snapshot, never a reconstructed timeline.
export interface ImportCandidateGeneration {
  sourceFile: string; // relative path, e.g. "progress/state.json"
  summary: string;
}

export interface ImportScanResult {
  photos: ImportCandidateMedia[];
  videos: ImportCandidateMedia[];
  goal: ImportCandidateGoal | null;
  generation: ImportCandidateGeneration | null;
  /** Non-fatal notes about what was skipped/truncated during the scan. */
  notes: string[];
}

export interface ImportApplyRequest {
  photoSourcePaths: string[];
  videoSourcePaths: string[];
  importGoal: boolean;
  importGeneration: boolean;
}

export interface ImportApplyResult {
  photosImported: number;
  videosImported: number;
  goalImported: boolean;
  generationImported: boolean;
}
