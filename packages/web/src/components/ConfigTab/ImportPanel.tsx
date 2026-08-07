import { useState } from 'react';
import type { ImportScanResult, ImportApplyResult } from '@gauntlet-wrapper/shared';

interface ImportPanelProps {
  projectId: string;
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function ImportPanel({ projectId }: ImportPanelProps) {
  const [scan, setScan] = useState<ImportScanResult | null>(null);
  const [scanning, setScanning] = useState(false);
  const [applying, setApplying] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<ImportApplyResult | null>(null);

  const [selectedPhotos, setSelectedPhotos] = useState<Set<string>>(new Set());
  const [selectedVideos, setSelectedVideos] = useState<Set<string>>(new Set());
  const [importGoal, setImportGoal] = useState(true);
  const [importGeneration, setImportGeneration] = useState(true);

  const runScan = async () => {
    setScanning(true);
    setError(null);
    setResult(null);
    try {
      const res = await fetch(`/api/projects/${projectId}/import/scan`);
      const body = await res.json();
      if (!res.ok) throw new Error(body.error ?? `HTTP ${res.status}`);
      const data = body as ImportScanResult;
      setScan(data);
      setSelectedPhotos(new Set(data.photos.map((p) => p.sourcePath)));
      setSelectedVideos(new Set(data.videos.map((v) => v.sourcePath)));
      setImportGoal(data.goal !== null);
      setImportGeneration(data.generation !== null);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setScanning(false);
    }
  };

  const toggle = (set: Set<string>, setSet: (s: Set<string>) => void, key: string) => {
    const next = new Set(set);
    if (next.has(key)) next.delete(key);
    else next.add(key);
    setSet(next);
  };

  const apply = async () => {
    if (!scan) return;
    setApplying(true);
    setError(null);
    try {
      const res = await fetch(`/api/projects/${projectId}/import/apply`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          photoSourcePaths: [...selectedPhotos],
          videoSourcePaths: [...selectedVideos],
          importGoal: importGoal && scan.goal !== null,
          importGeneration: importGeneration && scan.generation !== null,
        }),
      });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error ?? `HTTP ${res.status}`);
      setResult(body as ImportApplyResult);
      setScan(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setApplying(false);
    }
  };

  return (
    <div style={{ border: '1px solid #333', borderRadius: '4px', padding: '0.75rem', background: '#1b1e24' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <strong>Import from existing project</strong>
        <button onClick={runScan} disabled={scanning}>
          {scanning ? 'Scanning...' : 'Scan for importable data'}
        </button>
      </div>
      <p style={{ fontSize: '0.8rem', color: '#888', margin: '0.4rem 0 0' }}>
        Looks for reference images/video, a goal/kickoff doc, and existing progress data already in this repo. Nothing is
        written until you review the results below and click Import.
      </p>

      {error && <p style={{ color: '#e88' }}>{error}</p>}

      {result && (
        <p style={{ color: '#7dd87d', fontSize: '0.85rem' }}>
          Imported {result.photosImported} photo(s), {result.videosImported} video(s)
          {result.goalImported ? ', goal' : ''}
          {result.generationImported ? ', one baseline generation' : ''}.
        </p>
      )}

      {scan && (
        <div style={{ marginTop: '0.75rem', display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
          {scan.notes.length > 0 && (
            <ul style={{ margin: 0, paddingLeft: '1.2rem', fontSize: '0.8rem', color: '#e8b84b' }}>
              {scan.notes.map((n, i) => (
                <li key={i}>{n}</li>
              ))}
            </ul>
          )}

          <div>
            <strong style={{ fontSize: '0.85rem' }}>Photos ({scan.photos.length})</strong>
            <div style={{ maxHeight: '140px', overflowY: 'auto', fontSize: '0.8rem' }}>
              {scan.photos.map((p) => (
                <label key={p.sourcePath} style={{ display: 'block', padding: '0.15rem 0' }}>
                  <input
                    type="checkbox"
                    checked={selectedPhotos.has(p.sourcePath)}
                    onChange={() => toggle(selectedPhotos, setSelectedPhotos, p.sourcePath)}
                  />{' '}
                  {p.relativePath} <span style={{ color: '#888' }}>({formatBytes(p.sizeBytes)})</span>
                </label>
              ))}
              {scan.photos.length === 0 && <p style={{ color: '#888' }}>None found.</p>}
            </div>
          </div>

          <div>
            <strong style={{ fontSize: '0.85rem' }}>Videos ({scan.videos.length})</strong>
            <div style={{ maxHeight: '140px', overflowY: 'auto', fontSize: '0.8rem' }}>
              {scan.videos.map((v) => (
                <label key={v.sourcePath} style={{ display: 'block', padding: '0.15rem 0' }}>
                  <input
                    type="checkbox"
                    checked={selectedVideos.has(v.sourcePath)}
                    onChange={() => toggle(selectedVideos, setSelectedVideos, v.sourcePath)}
                  />{' '}
                  {v.relativePath} <span style={{ color: '#888' }}>({formatBytes(v.sizeBytes)})</span>
                </label>
              ))}
              {scan.videos.length === 0 && <p style={{ color: '#888' }}>None found.</p>}
            </div>
          </div>

          <div>
            <label style={{ fontSize: '0.85rem' }}>
              <input
                type="checkbox"
                checked={importGoal}
                disabled={!scan.goal}
                onChange={(e) => setImportGoal(e.target.checked)}
              />{' '}
              <strong>Goal</strong> {scan.goal ? `-- from ${scan.goal.sourceFile}` : '(none found)'}
            </label>
            {scan.goal && (
              <pre
                style={{
                  fontSize: '0.75rem',
                  color: '#aaa',
                  maxHeight: '120px',
                  overflowY: 'auto',
                  whiteSpace: 'pre-wrap',
                  background: '#14161a',
                  padding: '0.4rem',
                  borderRadius: '4px',
                }}
              >
                {scan.goal.preview}
                {scan.goal.fullLength > scan.goal.preview.length ? '\n... (truncated preview, full file will be imported)' : ''}
              </pre>
            )}
          </div>

          <div>
            <label style={{ fontSize: '0.85rem' }}>
              <input
                type="checkbox"
                checked={importGeneration}
                disabled={!scan.generation}
                onChange={(e) => setImportGeneration(e.target.checked)}
              />{' '}
              <strong>Progress</strong> {scan.generation ? `-- from ${scan.generation.sourceFile}` : '(none found)'}
            </label>
            {scan.generation && (
              <p style={{ fontSize: '0.8rem', color: '#aaa', margin: '0.3rem 0 0' }}>
                Will be recorded as one imported-baseline generation: "{scan.generation.summary}"
              </p>
            )}
          </div>

          <button onClick={apply} disabled={applying} style={{ alignSelf: 'flex-start' }}>
            {applying ? 'Importing...' : 'Import selected'}
          </button>
        </div>
      )}
    </div>
  );
}
