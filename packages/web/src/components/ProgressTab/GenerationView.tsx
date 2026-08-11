import type { GenerationRecord } from '@gauntlet-wrapper/shared';
import { LaneTable } from './LaneTable';

interface GenerationViewProps {
  projectId: string;
  generation: GenerationRecord;
}

export function GenerationView({ projectId, generation }: GenerationViewProps) {
  const perf = generation.performanceGate;

  return (
    <div style={{ border: '1px solid #333', borderRadius: '4px', padding: '0.75rem', background: '#1b1e24' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', flexWrap: 'wrap', gap: '0.5rem' }}>
        <strong>
          Gen {generation.generation} -- {generation.label}
        </strong>
        <span style={{ fontSize: '0.75rem', color: '#888' }}>{new Date(generation.createdAt).toLocaleString()}</span>
      </div>

      <div style={{ fontSize: '0.8rem', color: '#aaa', margin: '0.3rem 0' }}>
        {generation.gitDirty ? (
          <span style={{ color: '#e8b84b' }}>dirty worktree</span>
        ) : (
          <span>commit {generation.gitSha ?? '(unknown)'}</span>
        )}
        {' · '}
        <span style={{ color: perf.evaluated ? (perf.pass ? '#7dd87d' : '#e88') : '#888' }}>
          performance: {perf.evaluated ? (perf.pass ? 'pass' : `fail${perf.reason ? ` (${perf.reason})` : ''}`) : 'not evaluated'}
        </span>
      </div>

      <p style={{ fontSize: '0.85rem', margin: '0.5rem 0' }}>{generation.statusNote}</p>

      <LaneTable projectId={projectId} lanes={generation.lanes} />

      {generation.failingRequirementIds.length > 0 && (
        <p style={{ fontSize: '0.8rem', color: '#e88', marginTop: '0.5rem' }}>
          Failing requirements: {generation.failingRequirementIds.join(', ')}
        </p>
      )}
    </div>
  );
}
