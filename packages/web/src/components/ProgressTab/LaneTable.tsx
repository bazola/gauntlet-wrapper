import type { LaneVerdict } from '@gauntlet-wrapper/shared';

interface LaneTableProps {
  lanes: LaneVerdict[];
}

export function LaneTable({ lanes }: LaneTableProps) {
  if (lanes.length === 0) return <p style={{ color: '#888', fontSize: '0.85rem' }}>No lane verdicts recorded.</p>;

  return (
    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.85rem' }}>
      <thead>
        <tr style={{ textAlign: 'left', borderBottom: '1px solid #333' }}>
          <th style={{ padding: '0.3rem 0.5rem' }}>Lane</th>
          <th style={{ padding: '0.3rem 0.5rem' }}>Winner</th>
          <th style={{ padding: '0.3rem 0.5rem' }}>Biggest gap</th>
          <th style={{ padding: '0.3rem 0.5rem' }}>Evidence</th>
        </tr>
      </thead>
      <tbody>
        {lanes.map((lane) => (
          <tr key={lane.lane} style={{ borderBottom: '1px solid #22252b', opacity: lane.void ? 0.55 : 1 }}>
            <td style={{ padding: '0.3rem 0.5rem', fontFamily: 'ui-monospace, monospace' }}>
              {lane.lane}
              {lane.void && (
                <span style={{ marginLeft: '0.4rem', color: '#e88', fontSize: '0.75rem' }}>
                  VOID{lane.voidReason ? `: ${lane.voidReason}` : ''}
                </span>
              )}
            </td>
            <td
              style={{
                padding: '0.3rem 0.5rem',
                color: lane.winner === 'ours' ? '#7dd87d' : lane.winner === 'reference' ? '#e88' : '#888',
              }}
            >
              {lane.winner}
            </td>
            <td style={{ padding: '0.3rem 0.5rem' }}>{lane.biggestGap || <em style={{ color: '#666' }}>(none)</em>}</td>
            <td style={{ padding: '0.3rem 0.5rem', color: '#8cf', fontSize: '0.8rem' }}>
              {lane.evidence.length > 0 ? lane.evidence.join(', ') : <span style={{ color: '#666' }}>none cited</span>}
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
