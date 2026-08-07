import { useEffect, useState } from 'react';

interface GoalMeta {
  schemaVersion: 1;
  currentVersion: number;
  history: Array<{ version: number; editedAt: string; editedBy: string; note?: string }>;
}

interface GoalEditorProps {
  projectId: string;
}

export function GoalEditor({ projectId }: GoalEditorProps) {
  const [text, setText] = useState('');
  const [meta, setMeta] = useState<GoalMeta | null>(null);
  const [dirty, setDirty] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setText('');
    setMeta(null);
    setDirty(false);
    fetch(`/api/projects/${projectId}/goal`)
      .then((res) => res.json())
      .then((body: { text: string; meta: GoalMeta }) => {
        setText(body.text);
        setMeta(body.meta);
      })
      .catch(() => {});
  }, [projectId]);

  const save = async () => {
    setSaving(true);
    setError(null);
    try {
      const res = await fetch(`/api/projects/${projectId}/goal`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body.error ?? `HTTP ${res.status}`);
      setMeta(body.meta);
      setDirty(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
        <strong>Goal</strong>
        {meta && (
          <span style={{ fontSize: '0.8rem', color: '#888' }}>
            version {meta.currentVersion}
            {meta.history.length > 0 ? ` · ${meta.history.length} edit(s)` : ''}
          </span>
        )}
      </div>
      <textarea
        value={text}
        onChange={(e) => {
          setText(e.target.value);
          setDirty(true);
        }}
        rows={12}
        style={{ padding: '0.6rem', fontFamily: 'ui-monospace, monospace', fontSize: '0.85rem' }}
        placeholder="# Goal&#10;&#10;Describe what this project is trying to build."
      />
      <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
        <button onClick={save} disabled={saving || !dirty}>
          {saving ? 'Saving...' : 'Save goal'}
        </button>
        {dirty && <span style={{ color: '#e8b84b', fontSize: '0.8rem' }}>unsaved changes</span>}
        {error && <span style={{ color: '#e88' }}>{error}</span>}
      </div>
    </div>
  );
}
