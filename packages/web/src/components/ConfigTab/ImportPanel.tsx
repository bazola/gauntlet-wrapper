import { useState } from 'react';
import type { ImportScanResult, ImportApplyResult, ImportCandidateMedia } from '@gauntlet-wrapper/shared';

interface ImportPanelProps {
  projectId: string;
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

// sourcePath -> note text. Presence as a key = selected for import.
type SelectionMap = Map<string, string>;

export function ImportPanel({ projectId }: ImportPanelProps) {
  const [scan, setScan] = useState<ImportScanResult | null>(null);
  const [scanning, setScanning] = useState(false);
  const [applying, setApplying] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<ImportApplyResult | null>(null);

  const [selectedPhotos, setSelectedPhotos] = useState<SelectionMap>(new Map());
  const [selectedVideos, setSelectedVideos] = useState<SelectionMap>(new Map());
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
      setSelectedPhotos(new Map(data.photos.map((p) => [p.sourcePath, p.suggestedNote])));
      setSelectedVideos(new Map(data.videos.map((v) => [v.sourcePath, v.suggestedNote])));
      setImportGoal(data.goal !== null);
      setImportGeneration(data.generation !== null);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setScanning(false);
    }
  };

  const toggle = (map: SelectionMap, setMap: (m: SelectionMap) => void, item: ImportCandidateMedia) => {
    const next = new Map(map);
    if (next.has(item.sourcePath)) next.delete(item.sourcePath);
    else next.set(item.sourcePath, item.suggestedNote);
    setMap(next);
  };

  const setNote = (map: SelectionMap, setMap: (m: SelectionMap) => void, sourcePath: string, note: string) => {
    const next = new Map(map);
    next.set(sourcePath, note);
    setMap(next);
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
          photos: [...selectedPhotos].map(([sourcePath, note]) => ({ sourcePath, note })),
          videos: [...selectedVideos].map(([sourcePath, note]) => ({ sourcePath, note })),
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

  const renderMediaList = (items: ImportCandidateMedia[], map: SelectionMap, setMap: (m: SelectionMap) => void) => (
    <div style={{ maxHeight: '220px', overflowY: 'auto', fontSize: '0.8rem' }}>
      {items.map((item) => {
        const selected = map.has(item.sourcePath);
        return (
          <div key={item.sourcePath} style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', padding: '0.2rem 0' }}>
            <input type="checkbox" checked={selected} onChange={() => toggle(map, setMap, item)} />
            <span style={{ flex: '0 0 auto', whiteSpace: 'nowrap' }}>
              {item.relativePath} <span style={{ color: '#888' }}>({formatBytes(item.sizeBytes)})</span>
            </span>
            <input
              type="text"
              placeholder="note"
              value={map.get(item.sourcePath) ?? ''}
              disabled={!selected}
              onChange={(e) => setNote(map, setMap, item.sourcePath, e.target.value)}
              style={{ flex: 1, padding: '0.2rem 0.4rem', fontSize: '0.78rem' }}
            />
          </div>
        );
      })}
      {items.length === 0 && <p style={{ color: '#888' }}>None found.</p>}
    </div>
  );

  return (
    <div style={{ border: '1px solid #333', borderRadius: '4px', padding: '0.75rem', background: '#1b1e24' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <strong>Import from existing project</strong>
        <button onClick={runScan} disabled={scanning}>
          {scanning ? 'Scanning...' : 'Scan for importable data'}
        </button>
      </div>
      <p style={{ fontSize: '0.8rem', color: '#888', margin: '0.4rem 0 0' }}>
        Looks for reference images/video, a goal/kickoff doc, and existing progress data already in this repo -- including a
        references/derived/catalog.json-style preprocessing catalog, if one exists, for per-file tags and notes. Nothing is
        written until you review (and can edit) the results below and click Import.
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
            {renderMediaList(scan.photos, selectedPhotos, setSelectedPhotos)}
          </div>

          <div>
            <strong style={{ fontSize: '0.85rem' }}>Videos ({scan.videos.length})</strong>
            {renderMediaList(scan.videos, selectedVideos, setSelectedVideos)}
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
