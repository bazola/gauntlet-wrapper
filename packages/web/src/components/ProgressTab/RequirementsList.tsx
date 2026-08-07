import type { Requirement } from '@gauntlet-wrapper/shared';

interface RequirementsListProps {
  requirements: Requirement[];
}

export function RequirementsList({ requirements }: RequirementsListProps) {
  if (requirements.length === 0) {
    return <p style={{ color: '#888', fontSize: '0.85rem' }}>No standing requirements yet.</p>;
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
      {requirements.map((req) => (
        <div
          key={req.id}
          style={{
            border: '1px solid #333',
            borderRadius: '4px',
            padding: '0.5rem 0.7rem',
            background: '#1b1e24',
            opacity: req.status === 'retired' ? 0.5 : 1,
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', gap: '0.5rem' }}>
            <strong style={{ fontFamily: 'ui-monospace, monospace', fontSize: '0.85rem' }}>{req.id}</strong>
            <span style={{ fontSize: '0.75rem', color: '#888' }}>
              {req.kind} · {req.status} · since gen {req.createdAtGeneration}
            </span>
          </div>
          <p style={{ fontSize: '0.85rem', margin: '0.3rem 0' }}>{req.assertion}</p>
          <p style={{ fontSize: '0.8rem', color: '#aaa', margin: '0.2rem 0' }}>Measured by: {req.measurement}</p>
          <p style={{ fontSize: '0.8rem', color: '#aaa', margin: '0.2rem 0' }}>Pass criteria: {req.passCriteria}</p>
        </div>
      ))}
    </div>
  );
}
