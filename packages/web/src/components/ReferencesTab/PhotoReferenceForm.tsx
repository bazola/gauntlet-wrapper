import { useRef, useState, type FormEvent } from 'react';

interface PhotoReferenceFormProps {
  projectId: string;
  onAdded: () => void;
}

export function PhotoReferenceForm({ projectId, onAdded }: PhotoReferenceFormProps) {
  const fileRef = useRef<HTMLInputElement | null>(null);
  const [note, setNote] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    const file = fileRef.current?.files?.[0];
    if (!file) {
      setError('choose a photo first');
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      const form = new FormData();
      form.append('file', file);
      form.append('note', note);
      const res = await fetch(`/api/projects/${projectId}/references/photo`, { method: 'POST', body: form });
      if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error ?? `HTTP ${res.status}`);
      setNote('');
      if (fileRef.current) fileRef.current.value = '';
      onAdded();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <form onSubmit={submit} style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
      <strong>Add Photo Reference</strong>
      <input ref={fileRef} type="file" accept="image/*" />
      <textarea
        placeholder="Short note about this reference"
        value={note}
        onChange={(e) => setNote(e.target.value)}
        rows={2}
        style={{ padding: '0.4rem' }}
      />
      <button type="submit" disabled={submitting} style={{ alignSelf: 'flex-start' }}>
        {submitting ? 'Uploading...' : 'Add photo reference'}
      </button>
      {error && <span style={{ color: '#e88' }}>{error}</span>}
    </form>
  );
}
