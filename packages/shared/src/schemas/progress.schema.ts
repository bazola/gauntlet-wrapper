import { z } from 'zod';

export const LaneIdSchema = z.enum([
  'performance',
  'correctness',
  'visual-fidelity',
  'visual-fidelity/materials-lighting-post',
  'visual-fidelity/geometry-silhouette',
  'temporal-fidelity',
  'gameplay-fidelity',
]);
export type LaneId = z.infer<typeof LaneIdSchema>;

export const LaneVerdictSchema = z.object({
  lane: LaneIdSchema,
  winner: z.enum(['ours', 'reference', 'n/a']),
  biggestGap: z.string(),
  evidence: z.array(z.string()),
  void: z.boolean(),
  voidReason: z.string().optional(),
  requirementIds: z.array(z.string()).optional(),
  judgedAt: z.string(),
});
export type LaneVerdict = z.infer<typeof LaneVerdictSchema>;

export const PerformanceGateSchema = z.object({
  evaluated: z.boolean(),
  pass: z.boolean(),
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
