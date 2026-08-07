import type { CSSProperties } from 'react';
import type { ReferencesCatalog } from '@gauntlet-wrapper/shared';

interface ReferenceListProps {
  projectId: string;
  catalog: ReferencesCatalog | null;
}

const cardStyle: CSSProperties = {
  border: '1px solid #333',
  borderRadius: '4px',
  padding: '0.5rem',
  background: '#1b1e24',
};

export function ReferenceList({ projectId, catalog }: ReferenceListProps) {
  if (!catalog) return <p>Loading references...</p>;

  const fileUrl = (kind: 'photo' | 'video', refId: string, filename: string) =>
    `/api/projects/${projectId}/references/file/${kind}/${refId}/${encodeURIComponent(filename)}`;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
      <section>
        <h3>Photo References ({catalog.photo.length})</h3>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: '0.75rem' }}>
          {catalog.photo.map((ref) => (
            <div key={ref.id} style={cardStyle}>
              <img
                src={fileUrl('photo', ref.id, ref.filename)}
                alt={ref.note || ref.filename}
                style={{ width: '100%', borderRadius: '4px', display: 'block' }}
              />
              <p style={{ fontSize: '0.85rem', margin: '0.4rem 0 0' }}>{ref.note || <em>(no note)</em>}</p>
            </div>
          ))}
          {catalog.photo.length === 0 && <p style={{ color: '#888' }}>None yet.</p>}
        </div>
      </section>

      <section>
        <h3>Video References ({catalog.video.length})</h3>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: '0.75rem' }}>
          {catalog.video.map((ref) => (
            <div key={ref.id} style={cardStyle}>
              <video src={fileUrl('video', ref.id, ref.filename)} controls style={{ width: '100%', borderRadius: '4px' }} />
              <p style={{ fontSize: '0.85rem', margin: '0.4rem 0 0' }}>{ref.note || <em>(no note)</em>}</p>
            </div>
          ))}
          {catalog.video.length === 0 && <p style={{ color: '#888' }}>None yet.</p>}
        </div>
      </section>

      <section>
        <h3>Gameplay References ({catalog.gameplay.length})</h3>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
          {catalog.gameplay.map((ref) => (
            <div key={ref.id} style={cardStyle}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
                <strong>{ref.goalText}</strong>
                <span
                  style={{
                    fontSize: '0.75rem',
                    padding: '0.1rem 0.5rem',
                    borderRadius: '10px',
                    background: ref.status === 'formalized' ? '#2d6cdf' : '#444',
                  }}
                >
                  {ref.status}
                </span>
              </div>
              {ref.gapText && <p style={{ fontSize: '0.85rem', margin: '0.3rem 0' }}>Gap: {ref.gapText}</p>}
              {ref.testIdeasText && (
                <p style={{ fontSize: '0.85rem', margin: '0.3rem 0', color: '#aaa' }}>Test ideas: {ref.testIdeasText}</p>
              )}
              {ref.derivedRequirementIds.length > 0 && (
                <p style={{ fontSize: '0.8rem', margin: '0.3rem 0', color: '#8cf' }}>
                  Requirements: {ref.derivedRequirementIds.join(', ')}
                </p>
              )}
            </div>
          ))}
          {catalog.gameplay.length === 0 && <p style={{ color: '#888' }}>None yet.</p>}
        </div>
      </section>
    </div>
  );
}
