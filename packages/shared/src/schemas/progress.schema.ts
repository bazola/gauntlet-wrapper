import { z } from 'zod';

// Deliberately a free-form string, not a fixed enum. Real projects keep their
// own long-established lane names (a mature project's critic lanes predate
// the wrapper and won't match a generic taxonomy exactly), and the wrapper's
// job is to render whatever's reported, not gatekeep specific identifiers --
// the only thing actually enforced is that a performance-shaped and a
// correctness-shaped lane get reported every round (see KICKOFF S5).
export const LaneIdSchema = z.string().min(1);
export type LaneId = z.infer<typeof LaneIdSchema>;

export const LaneVerdictSchema = z.object({
  id: LaneIdSchema,
  // Conventionally 'ours' | 'reference' | 'n/a', but real verdicts are
  // routinely nuanced -- partial wins per sub-aspect, "mixed", a carried-
  // forward "n/a (not this round's target)". Free text on purpose; a verdict
  // that has to be forced into three buckets loses exactly the nuance a
  // critic was trying to report.
  winner: z.string().min(1),
  biggestGap: z.string(),
  evidence: z.array(z.string()),
  // Bookkeeping fields Claude reasonably omits when they're implied (a lane
  // with real evidence + a gap description isn't void; the record's own
  // createdAt is a fine stand-in for exactly when it was judged) -- optional
  // rather than a validation failure over missing ceremony.
  void: z.boolean().optional(),
  voidReason: z.string().optional(),
  requirementIds: z.array(z.string()).optional(),
  judgedAt: z.string().optional(),
  // Which round/sub-round this specific finding was actually judged in, when
  // it differs from the generation record's own label -- e.g. a finding
  // carried forward unchanged from an earlier round.
  round: z.string().optional(),
  // True when this lane wasn't re-judged this generation -- the builder's top
  // 3 picks (KICKOFF S5) didn't touch it, so the critic didn't re-capture or
  // re-judge it; winner/biggestGap/evidence are copied forward verbatim from
  // `round`. Distinct from `round` alone (which can also label a genuinely
  // fresh sub-round judged under a different name) -- this is the explicit
  // signal the wrapper UI uses to collapse a repeated, unchanged verdict
  // instead of re-rendering the same evidence images every generation.
  unchanged: z.boolean().optional(),
});
export type LaneVerdict = z.infer<typeof LaneVerdictSchema>;

export const PerformanceGateSchema = z.object({
  evaluated: z.boolean(),
  // Nullable, not just boolean: when `evaluated` is false (round reverted
  // before shipping, harness didn't run, etc.) there is no pass/fail verdict
  // to report -- `null` is the honest value, forcing a boolean would mean
  // picking one that isn't true.
  pass: z.boolean().nullable(),
  evidence: z.array(z.string()),
  reason: z.string().optional(),
});
export type PerformanceGate = z.infer<typeof PerformanceGateSchema>;

// .gauntlet/progress/generations/gen-NNNN.json -- one immutable record per
// generation, written once by Claude and never edited afterward.
export const GenerationRecordSchema = z.object({
  schemaVersion: z.literal(1),
  generation: z.number().int().nonnegative(),
  label: z.string(),
  createdAt: z.string(),
  gitSha: z.string().nullable(),
  gitDirty: z.boolean(),
  statusNote: z.string(),
  performanceGate: PerformanceGateSchema,
  lanes: z.array(LaneVerdictSchema),
  failingRequirementIds: z.array(z.string()),
});
export type GenerationRecord = z.infer<typeof GenerationRecordSchema>;

// .gauntlet/progress/state.json -- hot pointer, cheap to read on every poll.
export const ProgressStateSchema = z.object({
  schemaVersion: z.literal(1),
  currentGeneration: z.number().int().nonnegative(),
  activeLanes: z.array(LaneIdSchema),
  reviewerModel: z.string(),
  lastUpdatedAt: z.string(),
});
export type ProgressState = z.infer<typeof ProgressStateSchema>;

export const RequirementSchema = z.object({
  id: z.string(),
  kind: z.enum(['gameplay', 'correctness']),
  assertion: z.string(),
  measurement: z.string(),
  passCriteria: z.string(),
  status: z.enum(['active', 'retired']),
  sourceReferenceId: z.string().optional(),
  createdAt: z.string(),
  createdAtGeneration: z.number().int().nonnegative(),
});
export type Requirement = z.infer<typeof RequirementSchema>;

// .gauntlet/progress/requirements.json
export const RequirementsFileSchema = z.object({
  schemaVersion: z.literal(1),
  requirements: z.array(RequirementSchema),
});
export type RequirementsFile = z.infer<typeof RequirementsFileSchema>;

// Server-computed aggregate sent over the ws progress channel -- not itself
// read raw off disk, so no schema of its own; built from the already-validated
// pieces above. `errors` surfaces non-fatal parse/validation problems (e.g. a
// generation file mid-write) without failing the whole snapshot.
export interface ProgressSnapshot {
  state: ProgressState | null;
  requirements: RequirementsFile | null;
  generations: GenerationRecord[];
  errors: string[];
}
