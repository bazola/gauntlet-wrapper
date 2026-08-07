export type ProjectType =
  | 'browser-canvas'
  | 'browser-webgpu'
  | 'cli'
  | 'backend-service'
  | 'library'
  | 'other';

export type PerfHarnessKind = 'playwright-frame-based' | 'performance-contract-json' | 'none';

// .gauntlet/config.json -- wrapper-owned interchange data for one target repo.
// projectType/perfHarness are set by Claude after its discovery phase, not by
// the wrapper (the wrapper only ever writes the initial defaults below).
export interface GauntletConfig {
  schemaVersion: 1;
  projectId: string;
  displayName: string;
  goalSummary: string;
  reviewerModel: string;
  projectType: ProjectType;
  // Root-level binding docs Claude authored or discovered as this project's
  // bars (an architecture contract, a feel spec, whatever the project calls
  // for -- see KICKOFF S3). Formalized here, not left as tribal knowledge
  // inside one long conversation, so a brand-new session (fresh context,
  // reopened terminal) has an explicit, harness-tracked pointer back to
  // exactly which files to re-read and keep honoring -- see RESUME_NOTE S0.
  projectDocs: string[];
  perfHarness: {
    scaffolded: boolean;
    kind: PerfHarnessKind;
    entryScript: string | null;
  };
  visualFidelity: { enabled: boolean; splitSubLanes: boolean };
  temporalFidelity: { enabled: boolean };
  gameplayFidelity: { enabled: boolean };
  onboarding: {
    completed: boolean;
    scaffoldedAt: string | null;
    seedPromptDelivered: boolean;
  };
  // Where onboarding installed the Notification hook -- settings.json unless
  // that file is already git-tracked in the target repo, in which case
  // settings.local.json (never risking a machine-specific path/port landing
  // in shared history).
  notificationHook: {
    installed: boolean;
    target: 'settings.json' | 'settings.local.json' | null;
  };
  createdAt: string;
  updatedAt: string;
}
