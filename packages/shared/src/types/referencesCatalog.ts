interface ReferenceBase {
  id: string;
  addedAt: string;
  addedAtGeneration: number | null;
}

export interface PhotoReference extends ReferenceBase {
  type: 'photo';
  filename: string;
  note: string;
  derived: { processed: boolean; tags: string[] };
}

export interface VideoReference extends ReferenceBase {
  type: 'video';
  filename: string;
  note: string;
  derived: { processed: boolean; stripCount: number };
}

export interface GameplayReference extends ReferenceBase {
  type: 'gameplay';
  goalText: string;
  gapText: string;
  testIdeasText: string;
  status: 'raw' | 'formalized';
  formalizedAt: string | null;
  derivedRequirementIds: string[];
}

// .gauntlet/references/catalog.json
export interface ReferencesCatalog {
  schemaVersion: 1;
  photo: PhotoReference[];
  video: VideoReference[];
  gameplay: GameplayReference[];
}
