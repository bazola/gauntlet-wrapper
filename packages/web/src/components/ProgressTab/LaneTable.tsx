import type { LaneVerdict } from '@gauntlet-wrapper/shared';

interface LaneTableProps {
  projectId: string;
  lanes: LaneVerdict[];
  labelToGeneration: Map<string, number>;
}

const IMAGE_EXTENSIONS = ['.png', '.jpg', '.jpeg', '.gif', '.webp', '.bmp'];

function isImagePath(path: string): boolean {
  const lower = path.toLowerCase();
  return IMAGE_EXTENSIONS.some((ext) => lower.endsWith(ext));
}

function evidenceUrl(projectId: string, path: string): string {
  return `/api/projects/${projectId}/evidence?path=${encodeURIComponent(path)}`;
}

// Conventionally 'ours' | 'reference' | 'n/a', but real verdicts are often
// nuanced free text ("mixed (...)", "ours (a); reference (b, open)") -- this
// gives *some* color signal without pretending those strings fit three
// buckets.
function winnerColor(winner: string): string {
  const lower = winner.toLowerCase();
  const hasOurs = lower.includes('ours');
  const hasReference = lower.includes('reference');
  if (hasOurs && hasReference) return '#e8b84b'; // mixed
  if (hasOurs) return '#7dd87d';
  if (hasReference) return '#e88';
  return '#888'; // n/a or unrecognized
}

function EvidenceList({ projectId, evidence }: { projectId: string; evidence: string[] }) {
  if (evidence.length === 0) return <span style={{ color: '#666' }}>none cited</span>;

  const images = evidence.filter(isImagePath);
  const other = evidence.filter((e) => !isImagePath(e));

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.3rem' }}>
      {images.length > 0 && (
        <div style={{ display: 'flex', gap: '0.4rem', flexWrap: 'wrap' }}>
          {images.map((path) => (
            <a key={path} href={evidenceUrl(projectId, path)} target="_blank" rel="noreferrer" title={path}>
              <img
                src={evidenceUrl(projectId, path)}
                alt={path}
                style={{ height: '64px', width: '64px', objectFit: 'cover', borderRadius: '3px', border: '1px solid #333' }}
              />
            </a>
          ))}
        </div>
      )}
      {other.length > 0 && (
        <div style={{ color: '#8cf' }}>
          {other.map((path) => (
            <a
              key={path}
              href={evidenceUrl(projectId, path)}
              target="_blank"
              rel="noreferrer"
              style={{ display: 'block', color: '#8cf' }}
            >
              {path}
            </a>
          ))}
        </div>
      )}
    </div>
  );
}

// Carried-forward lane (KICKOFF S5: `unchanged: true`) -- nothing this round
// touched it, so its evidence is a repeat of whatever was last captured for
// it. Showing that same image gallery again every round is exactly the
// visual noise this collapses: a one-line note plus a jump link to the
// generation where it was actually last judged, instead of re-rendering
// screenshots that haven't changed.
function UnchangedNotice({ round, labelToGeneration }: { round: string | undefined; labelToGeneration: Map<string, number> }) {
  const targetGeneration = round ? labelToGeneration.get(round) : undefined;
  return (
    <span style={{ color: '#888', fontStyle: 'italic' }}>
      unchanged
      {round && (
        <>
          {' -- last judged '}
          {targetGeneration !== undefined ? (
            <a href={`#gen-${targetGeneration}`} style={{ color: '#8cf', fontStyle: 'normal' }}>
              {round} ↓
            </a>
          ) : (
            round
          )}
        </>
      )}
    </span>
  );
}

export function LaneTable({ projectId, lanes, labelToGeneration }: LaneTableProps) {
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
          <tr key={lane.id} style={{ borderBottom: '1px solid #22252b', opacity: lane.void ? 0.55 : 1 }}>
            <td style={{ padding: '0.3rem 0.5rem', fontFamily: 'ui-monospace, monospace', verticalAlign: 'top' }}>
              {lane.id}
              {lane.round && !lane.unchanged && <div style={{ fontSize: '0.7rem', color: '#888' }}>{lane.round}</div>}
              {lane.void && (
                <span style={{ display: 'block', marginTop: '0.2rem', color: '#e88', fontSize: '0.75rem' }}>
                  VOID{lane.voidReason ? `: ${lane.voidReason}` : ''}
                </span>
              )}
            </td>
            <td style={{ padding: '0.3rem 0.5rem', color: winnerColor(lane.winner), verticalAlign: 'top' }}>{lane.winner}</td>
            <td style={{ padding: '0.3rem 0.5rem', verticalAlign: 'top' }}>
              {lane.biggestGap || <em style={{ color: '#666' }}>(none)</em>}
            </td>
            <td style={{ padding: '0.3rem 0.5rem', fontSize: '0.8rem', verticalAlign: 'top' }}>
              {lane.unchanged ? (
                <UnchangedNotice round={lane.round} labelToGeneration={labelToGeneration} />
              ) : (
                <EvidenceList projectId={projectId} evidence={lane.evidence} />
              )}
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
