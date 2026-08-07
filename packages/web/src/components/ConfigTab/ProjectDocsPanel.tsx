import { useEffect, useState } from 'react';
import type { GauntletConfig } from '@gauntlet-wrapper/shared';

interface ProjectDocsPanelProps {
  projectId: string;
}

export function ProjectDocsPanel({ projectId }: ProjectDocsPanelProps) {
  const [docs, setDocs] = useState<string[]>([]);
  const [newDoc, setNewDoc] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = () => {
    fetch(`/api/projects/${projectId}/config`)
      .then((res) => res.json())
      .then((config: GauntletConfig) => setDocs(config.projectDocs))
      .catch(() => {});
  };

  useEffect(load, [projectId]);

  const save = async (next: string[]) => {
    setSaving(true);
    setError(null);
    try {
      const res = await fetch(`/api/projects/${projectId}/project-docs`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ projectDocs: next }),
      });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error ?? `HTTP ${res.status}`);
      setDocs((body as GauntletConfig).projectDocs);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setSaving(false);
    }
  };

  const add = () => {
    const name = newDoc.trim();
    if (name.length === 0 || docs.includes(name)) return;
    save([...docs, name]);
    setNewDoc('');
  };

  const remove = (name: string) => save(docs.filter((d) => d !== name));

  return (
    <div style={{ border: '1px solid #333', borderRadius: '4px', padding: '0.75rem', background: '#1b1e24' }}>
      <strong>Project docs</strong>
      <p style={{ fontSize: '0.8rem', color: '#888', margin: '0.4rem 0' }}>
        The binding architecture/feel/evidence-style bars this project's own Claude session authors or discovers at
        root (see kickoff S3). Formalized here so every future session's resume note points straight back at them
        instead of relying on being in the same conversation that found them. Claude maintains this list itself, but
        you can correct it here too.
      </p>

      {docs.length === 0 ? (
        <p style={{ color: '#888', fontSize: '0.85rem' }}>None recorded yet.</p>
      ) : (
        <ul style={{ margin: '0.4rem 0', paddingLeft: '1.2rem', fontSize: '0.85rem' }}>
          {docs.map((doc) => (
            <li key={doc} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '0.5rem' }}>
              <code>{doc}</code>
              <button onClick={() => remove(doc)} disabled={saving} style={{ fontSize: '0.7rem' }}>
                remove
              </button>
            </li>
          ))}
        </ul>
      )}

      <div style={{ display: 'flex', gap: '0.4rem', marginTop: '0.4rem' }}>
        <input
          placeholder="ARCHITECTURE.md"
          value={newDoc}
          onChange={(e) => setNewDoc(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && add()}
          style={{ flex: 1, padding: '0.3rem 0.5rem', fontSize: '0.85rem' }}
        />
        <button onClick={add} disabled={saving || newDoc.trim().length === 0}>
          Add
        </button>
      </div>

      {error && <p style={{ color: '#e88', fontSize: '0.85rem' }}>{error}</p>}
    </div>
  );
}
