import { useEffect, useState } from 'react';
import type { GauntletConfig } from '@gauntlet-wrapper/shared';

interface ReviewerModelPickerProps {
  projectId: string;
}

const MODEL_SUGGESTIONS = ['opus', 'sonnet', 'haiku'];

export function ReviewerModelPicker({ projectId }: ReviewerModelPickerProps) {
  const [projectModel, setProjectModel] = useState('');
  const [globalDefault, setGlobalDefault] = useState('');
  const [savingProject, setSavingProject] = useState(false);
  const [savingGlobal, setSavingGlobal] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setProjectModel('');
    fetch(`/api/projects/${projectId}/config`)
      .then((res) => res.json())
      .then((config: GauntletConfig) => setProjectModel(config.reviewerModel))
      .catch(() => {});
  }, [projectId]);

  useEffect(() => {
    fetch('/api/settings')
      .then((res) => res.json())
      .then((settings: { defaultReviewerModel: string }) => setGlobalDefault(settings.defaultReviewerModel))
      .catch(() => {});
  }, []);

  const saveProjectModel = async () => {
    setSavingProject(true);
    setError(null);
    try {
      const res = await fetch(`/api/projects/${projectId}/config`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reviewerModel: projectModel }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body.error ?? `HTTP ${res.status}`);
      setProjectModel(body.reviewerModel);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setSavingProject(false);
    }
  };

  const saveGlobalDefault = async () => {
    setSavingGlobal(true);
    setError(null);
    try {
      const res = await fetch('/api/settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ defaultReviewerModel: globalDefault }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body.error ?? `HTTP ${res.status}`);
      setGlobalDefault(body.defaultReviewerModel);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setSavingGlobal(false);
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
      <strong>Reviewer model</strong>
      <p style={{ fontSize: '0.8rem', color: '#888', margin: 0 }}>
        Critic subagents are always spawned with this project's reviewer model. The session/builder
        model in the terminal is controlled separately, from inside the terminal itself.
      </p>

      <label style={{ display: 'flex', flexDirection: 'column', gap: '0.3rem' }}>
        <span style={{ fontSize: '0.85rem' }}>This project</span>
        <div style={{ display: 'flex', gap: '0.5rem' }}>
          <input
            list="reviewer-model-suggestions"
            value={projectModel}
            onChange={(e) => setProjectModel(e.target.value)}
            style={{ padding: '0.4rem', flex: 1 }}
          />
          <button onClick={saveProjectModel} disabled={savingProject || projectModel.trim().length === 0}>
            {savingProject ? 'Saving...' : 'Save'}
          </button>
        </div>
      </label>

      <label style={{ display: 'flex', flexDirection: 'column', gap: '0.3rem' }}>
        <span style={{ fontSize: '0.85rem' }}>Global default (used when onboarding new projects)</span>
        <div style={{ display: 'flex', gap: '0.5rem' }}>
          <input
            list="reviewer-model-suggestions"
            value={globalDefault}
            onChange={(e) => setGlobalDefault(e.target.value)}
            style={{ padding: '0.4rem', flex: 1 }}
          />
          <button onClick={saveGlobalDefault} disabled={savingGlobal || globalDefault.trim().length === 0}>
            {savingGlobal ? 'Saving...' : 'Save'}
          </button>
        </div>
      </label>

      <datalist id="reviewer-model-suggestions">
        {MODEL_SUGGESTIONS.map((m) => (
          <option key={m} value={m} />
        ))}
      </datalist>

      {error && <span style={{ color: '#e88' }}>{error}</span>}
    </div>
  );
}
