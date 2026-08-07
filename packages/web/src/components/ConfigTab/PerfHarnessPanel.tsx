import { useEffect, useState } from 'react';
import type { GauntletConfig } from '@gauntlet-wrapper/shared';

interface PerfHarnessPanelProps {
  projectId: string;
}

export function PerfHarnessPanel({ projectId }: PerfHarnessPanelProps) {
  const [config, setConfig] = useState<GauntletConfig | null>(null);
  const [scaffolding, setScaffolding] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copiedFiles, setCopiedFiles] = useState<string[] | null>(null);

  const loadConfig = () => {
    fetch(`/api/projects/${projectId}/config`)
      .then((res) => res.json())
      .then(setConfig)
      .catch(() => {});
  };

  useEffect(loadConfig, [projectId]);

  const scaffold = async () => {
    setScaffolding(true);
    setError(null);
    setCopiedFiles(null);
    try {
      const res = await fetch(`/api/projects/${projectId}/perf/scaffold`, { method: 'POST' });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error ?? `HTTP ${res.status}`);
      setCopiedFiles(body.copiedFiles);
      loadConfig();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setScaffolding(false);
    }
  };

  if (!config) return null;

  const isBrowserProject = config.projectType === 'browser-canvas' || config.projectType === 'browser-webgpu';

  return (
    <div style={{ border: '1px solid #333', borderRadius: '4px', padding: '0.75rem', background: '#1b1e24' }}>
      <strong>Performance harness</strong>
      <p style={{ fontSize: '0.8rem', color: '#888', margin: '0.4rem 0' }}>
        Scaffolds a Playwright-based GPU hardware gate + frame-time/heap-growth harness into <code>harness/</code> --
        works for browser-canvas/browser-webgpu projects. For anything else, the standing bar is the Performance
        Contract schema in the kickoff prompt instead (no starter code to scaffold there).
      </p>

      {config.perfHarness.scaffolded ? (
        <p style={{ fontSize: '0.85rem', color: '#7dd87d' }}>
          Scaffolded ({config.perfHarness.kind}) -- entry point: <code>{config.perfHarness.entryScript}</code>
        </p>
      ) : (
        <>
          {!isBrowserProject && (
            <p style={{ fontSize: '0.8rem', color: '#e8b84b' }}>
              Discovered project type is "{config.projectType}" -- this starter is built for canvas/WebGPU rendering.
              You can still scaffold it if this project does render frames and the type just hasn't been set yet.
            </p>
          )}
          <button onClick={scaffold} disabled={scaffolding}>
            {scaffolding ? 'Scaffolding...' : 'Scaffold performance harness'}
          </button>
        </>
      )}

      {error && <p style={{ color: '#e88' }}>{error}</p>}
      {copiedFiles && (
        <div style={{ fontSize: '0.8rem', color: '#aaa', marginTop: '0.4rem' }}>
          {copiedFiles.length > 0 ? (
            <>
              <p style={{ margin: '0.2rem 0' }}>Copied {copiedFiles.length} file(s). See harness/README.md for wiring instructions.</p>
            </>
          ) : (
            <p style={{ margin: '0.2rem 0' }}>Already present -- nothing was overwritten.</p>
          )}
        </div>
      )}
    </div>
  );
}
