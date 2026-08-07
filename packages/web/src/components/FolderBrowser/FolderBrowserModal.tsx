import { useEffect, useState } from 'react';

interface BrowseEntry {
  name: string;
  path: string;
}
interface BrowseResponse {
  path: string;
  parent: string | null;
  roots: string[];
  entries: BrowseEntry[];
}

interface FolderBrowserModalProps {
  initialPath?: string;
  onSelect: (path: string) => void;
  onClose: () => void;
}

export function FolderBrowserModal({ initialPath, onSelect, onClose }: FolderBrowserModalProps) {
  const [data, setData] = useState<BrowseResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const load = (path?: string) => {
    setLoading(true);
    setError(null);
    const qs = path ? `?path=${encodeURIComponent(path)}` : '';
    fetch(`/api/filesystem/browse${qs}`)
      .then(async (res) => {
        const body = await res.json();
        if (!res.ok) throw new Error(body.error ?? `HTTP ${res.status}`);
        setData(body as BrowseResponse);
      })
      .catch((err) => setError(err instanceof Error ? err.message : String(err)))
      .finally(() => setLoading(false));
  };

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => load(initialPath), []);

  return (
    <div
      onClick={onClose}
      style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.55)', zIndex: 2000, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{ background: '#1b1e24', border: '1px solid #333', borderRadius: '8px', padding: '1.25rem', width: '520px', maxWidth: '90vw', color: '#e8e8e8' }}
      >
        <h3 style={{ marginTop: 0 }}>Choose a project folder</h3>

        <div style={{ display: 'flex', gap: '0.4rem', marginBottom: '0.6rem', flexWrap: 'wrap' }}>
          {data?.roots.map((root) => (
            <button key={root} onClick={() => load(root)}>
              {root}
            </button>
          ))}
        </div>

        <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', marginBottom: '0.5rem' }}>
          <button onClick={() => data?.parent && load(data.parent)} disabled={!data?.parent}>
            Up
          </button>
          <code style={{ fontSize: '0.8rem', color: '#aaa', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {data?.path ?? ''}
          </code>
        </div>

        {error && <p style={{ color: '#e88' }}>{error}</p>}

        <div style={{ height: '320px', overflowY: 'auto', border: '1px solid #333', borderRadius: '4px' }}>
          {loading && <p style={{ padding: '0.5rem' }}>Loading...</p>}
          {!loading &&
            data?.entries.map((entry) => (
              <div
                key={entry.path}
                onDoubleClick={() => load(entry.path)}
                title="Double-click to open"
                style={{ padding: '0.4rem 0.6rem', cursor: 'pointer', borderBottom: '1px solid #22252b' }}
              >
                {entry.name}
              </div>
            ))}
          {!loading && data && data.entries.length === 0 && <p style={{ padding: '0.5rem', color: '#888' }}>No subfolders.</p>}
        </div>

        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.5rem', marginTop: '0.75rem' }}>
          <button onClick={onClose}>Cancel</button>
          <button onClick={() => data && onSelect(data.path)} disabled={!data}>
            Select this folder
          </button>
        </div>
      </div>
    </div>
  );
}
