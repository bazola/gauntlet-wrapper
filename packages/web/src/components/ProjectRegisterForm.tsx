import { useState, type FormEvent } from 'react';
import type { ProjectRegistryEntry } from '@gauntlet-wrapper/shared';
import { FolderBrowserModal } from './FolderBrowser/FolderBrowserModal';

interface ProjectRegisterFormProps {
  onRegistered: (project: ProjectRegistryEntry) => void;
}

export function ProjectRegisterForm({ onRegistered }: ProjectRegisterFormProps) {
  const [path, setPath] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [browserOpen, setBrowserOpen] = useState(false);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch('/api/projects', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ path, displayName }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body.error ?? `HTTP ${res.status}`);
      onRegistered(body.project as ProjectRegistryEntry);
      setPath('');
      setDisplayName('');
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <>
      <form onSubmit={submit} style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', flexWrap: 'wrap' }}>
        <input
          placeholder="C:\path\to\target-repo"
          value={path}
          onChange={(e) => setPath(e.target.value)}
          style={{ flex: 1, minWidth: '260px', padding: '0.4rem' }}
        />
        <button type="button" onClick={() => setBrowserOpen(true)}>
          Browse...
        </button>
        <input
          placeholder="Display name (optional)"
          value={displayName}
          onChange={(e) => setDisplayName(e.target.value)}
          style={{ padding: '0.4rem' }}
        />
        <button type="submit" disabled={submitting || path.trim().length === 0}>
          {submitting ? 'Registering...' : 'Register project'}
        </button>
        {error && <span style={{ color: '#e88' }}>{error}</span>}
      </form>

      {browserOpen && (
        <FolderBrowserModal
          initialPath={path || undefined}
          onSelect={(selected) => {
            setPath(selected);
            setBrowserOpen(false);
          }}
          onClose={() => setBrowserOpen(false)}
        />
      )}
    </>
  );
}
