import { useEffect, useState } from 'react';
import type { ProgressSnapshot, WsServerEnvelope } from '@gauntlet-wrapper/shared';
import { wsClient } from '../../api/wsClient';
import { GenerationView } from './GenerationView';
import { RequirementsList } from './RequirementsList';

interface ProgressTabProps {
  projectId: string;
}

export function ProgressTab({ projectId }: ProgressTabProps) {
  const [snapshot, setSnapshot] = useState<ProgressSnapshot | null>(null);

  useEffect(() => {
    setSnapshot(null);
    wsClient.send({ channel: 'progress', project: projectId, type: 'subscribe' });

    const off = wsClient.addListener((msg: WsServerEnvelope) => {
      if (msg.channel !== 'progress' || msg.project !== projectId) return;
      if (msg.type === 'snapshot') setSnapshot(msg.payload);
    });

    return () => {
      off();
      wsClient.send({ channel: 'progress', project: projectId, type: 'unsubscribe' });
    };
  }, [projectId]);

  if (!snapshot) return <p>Loading progress...</p>;

  const { state, requirements, generations, errors } = snapshot;
  const sortedDesc = [...generations].reverse();
  // Lets a carried-forward lane's `round` label (KICKOFF S5/S7) resolve to a
  // real generation number so the UI can link straight to where it was
  // actually last judged, instead of just printing the label as inert text.
  const labelToGeneration = new Map(generations.map((g) => [g.label, g.generation]));

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
      {errors.length > 0 && (
        <div style={{ border: '1px solid #a33', borderRadius: '4px', padding: '0.5rem 0.7rem', background: '#2a1c1c' }}>
          <strong style={{ color: '#e88' }}>Progress data issues</strong>
          <ul style={{ margin: '0.3rem 0 0', paddingLeft: '1.2rem', fontSize: '0.8rem', color: '#e88' }}>
            {errors.map((e, i) => (
              <li key={i}>{e}</li>
            ))}
          </ul>
        </div>
      )}

      <div style={{ fontSize: '0.85rem', color: '#aaa' }}>
        {state ? (
          <>
            Current generation: <strong style={{ color: '#e8e8e8' }}>{state.currentGeneration}</strong> · reviewer model:{' '}
            <strong style={{ color: '#e8e8e8' }}>{state.reviewerModel}</strong> · active lanes:{' '}
            {state.activeLanes.length > 0 ? state.activeLanes.join(', ') : 'none yet'}
          </>
        ) : (
          'No progress/state.json yet -- nothing recorded so far.'
        )}
      </div>

      <section>
        <h3>Generations ({generations.length})</h3>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
          {sortedDesc.map((gen) => (
            <GenerationView
              key={gen.generation}
              projectId={projectId}
              generation={gen}
              labelToGeneration={labelToGeneration}
            />
          ))}
          {generations.length === 0 && <p style={{ color: '#888' }}>No generations recorded yet.</p>}
        </div>
      </section>

      <section>
        <h3>Standing requirements ({requirements?.requirements.length ?? 0})</h3>
        <RequirementsList requirements={requirements?.requirements ?? []} />
      </section>
    </div>
  );
}
