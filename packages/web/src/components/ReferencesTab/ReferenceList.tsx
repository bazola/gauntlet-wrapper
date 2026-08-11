import { useState, type CSSProperties } from 'react';
import type { ReferencesCatalog, RequirementsFile } from '@gauntlet-wrapper/shared';

interface ReferenceListProps {
  projectId: string;
  catalog: ReferencesCatalog | null;
  requirements: RequirementsFile | null;
  onChanged: () => void;
}

const requirementCardStyle: CSSProperties = {
  border: '1px solid #2a2d34',
  borderRadius: '4px',
  padding: '0.4rem 0.6rem',
  marginTop: '0.3rem',
  background: '#14161a',
};

const cardStyle: CSSProperties = {
  border: '1px solid #333',
  borderRadius: '4px',
  padding: '0.5rem',
  background: '#1b1e24',
  position: 'relative',
};

const deleteButtonStyle: CSSProperties = {
  position: 'absolute',
  top: '0.4rem',
  right: '0.4rem',
  background: '#3a1f1f',
  color: '#e88',
  border: '1px solid #663',
  borderRadius: '4px',
  padding: '0.1rem 0.5rem',
  fontSize: '0.75rem',
  cursor: 'pointer',
};

export function ReferenceList({ projectId, catalog, requirements, onChanged }: ReferenceListProps) {
  const [deletingId, setDeletingId] = useState<string | null>(null);

  if (!catalog) return <p>Loading references...</p>;

  const requirementById = new Map((requirements?.requirements ?? []).map((r) => [r.id, r]));

  const fileUrl = (kind: 'photo' | 'video', refId: string, filename: string) =>
    `/api/projects/${projectId}/references/file/${kind}/${refId}/${encodeURIComponent(filename)}`;

  const remove = async (kind: 'photo' | 'video' | 'gameplay', refId: string, label: string) => {
    if (!confirm(`Delete this ${kind} reference (${label})? This cannot be undone.`)) return;
    setDeletingId(refId);
    try {
      const res = await fetch(`/api/projects/${projectId}/references/${kind}/${refId}`, { method: 'DELETE' });
      if (!res.ok && res.status !== 404) throw new Error(`HTTP ${res.status}`);
      onChanged();
    } catch (err) {
      alert(`Failed to delete: ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      setDeletingId(null);
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
      <section>
        <h3>Photo References ({catalog.photo.length})</h3>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: '0.75rem' }}>
          {catalog.photo.map((ref) => (
            <div key={ref.id} style={cardStyle}>
              <button
                onClick={() => remove('photo', ref.id, ref.filename)}
                disabled={deletingId === ref.id}
                style={deleteButtonStyle}
              >
                {deletingId === ref.id ? '...' : 'Delete'}
              </button>
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
              <button
                onClick={() => remove('video', ref.id, ref.filename)}
                disabled={deletingId === ref.id}
                style={deleteButtonStyle}
              >
                {deletingId === ref.id ? '...' : 'Delete'}
              </button>
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
              <button
                onClick={() => remove('gameplay', ref.id, ref.goalText.slice(0, 40))}
                disabled={deletingId === ref.id}
                style={deleteButtonStyle}
              >
                {deletingId === ref.id ? '...' : 'Delete'}
              </button>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', paddingRight: '4rem' }}>
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
                <div style={{ margin: '0.3rem 0' }}>
                  <p style={{ fontSize: '0.75rem', margin: '0 0 0.2rem', color: '#8cf' }}>Tested by:</p>
                  {ref.derivedRequirementIds.map((reqId) => {
                    const req = requirementById.get(reqId);
                    if (!req) {
                      // Formalized but the requirement wasn't found (retired, or
                      // requirements.json hasn't been written yet) -- fall back to
                      // the bare id rather than silently dropping the reference.
                      return (
                        <p key={reqId} style={{ fontSize: '0.8rem', margin: '0.2rem 0', color: '#888' }}>
                          {reqId} <em>(not found in requirements.json)</em>
                        </p>
                      );
                    }
                    return (
                      <div key={reqId} style={requirementCardStyle}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', gap: '0.5rem' }}>
                          <strong style={{ fontFamily: 'ui-monospace, monospace', fontSize: '0.8rem' }}>{req.id}</strong>
                          <span style={{ fontSize: '0.7rem', color: '#888' }}>{req.status}</span>
                        </div>
                        <p style={{ fontSize: '0.8rem', margin: '0.25rem 0' }}>{req.assertion}</p>
                        <p style={{ fontSize: '0.75rem', color: '#aaa', margin: '0.15rem 0' }}>Measured by: {req.measurement}</p>
                        <p style={{ fontSize: '0.75rem', color: '#aaa', margin: '0.15rem 0' }}>Pass criteria: {req.passCriteria}</p>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          ))}
          {catalog.gameplay.length === 0 && <p style={{ color: '#888' }}>None yet.</p>}
        </div>
      </section>
    </div>
  );
}
