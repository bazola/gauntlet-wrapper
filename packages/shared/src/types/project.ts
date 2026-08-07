// Wrapper-global project registry entry, persisted at ~/.gauntlet-wrapper/registry.json.
// Per-project config/goal/progress live only inside the target repo's own
// .gauntlet/ directory (see GauntletConfig) -- this is deliberately thin.
export interface ProjectRegistryEntry {
  id: string;
  path: string;
  displayName: string;
  createdAt: string;
}
