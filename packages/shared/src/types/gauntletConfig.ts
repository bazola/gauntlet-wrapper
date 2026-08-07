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
