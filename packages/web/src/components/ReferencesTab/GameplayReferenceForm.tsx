import { useState, type FormEvent } from 'react';

interface GameplayReferenceFormProps {
  projectId: string;
  onAdded: () => void;
}

export function GameplayReferenceForm({ projectId, onAdded }: GameplayReferenceFormProps) {
  const [goalText, setGoalText] = useState('');
  const [gapText, setGapText] = useState('');
  const [testIdeasText, setTestIdeasText] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (goalText.trim().length === 0) {
      setError('describe the gameplay goal first');
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch(`/api/projects/${projectId}/references/gameplay`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ goalText, gapText, testIdeasText }),
      });
      if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error ?? `HTTP ${res.status}`);
      setGoalText('');
      setGapText('');
      setTestIdeasText('');
      onAdded();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <form onSubmit={submit} style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
      <strong>Add Gameplay Reference</strong>
      <textarea
        placeholder="What gameplay do you want?"
        value={goalText}
        onChange={(e) => setGoalText(e.target.value)}
        rows={2}
        style={{ padding: '0.4rem' }}
      />
      <textarea
        placeholder="How does the current build not reach it?"
        value={gapText}
        onChange={(e) => setGapText(e.target.value)}
        rows={2}
        style={{ padding: '0.4rem' }}
      />
      <textarea
        placeholder="Any ideas for testing it?"
        value={testIdeasText}
        onChange={(e) => setTestIdeasText(e.target.value)}
        rows={2}
        style={{ padding: '0.4rem' }}
      />
      <button type="submit" disabled={submitting} style={{ alignSelf: 'flex-start' }}>
        {submitting ? 'Saving...' : 'Add gameplay reference'}
      </button>
      {error && <span style={{ color: '#e88' }}>{error}</span>}
    </form>
  );
}
