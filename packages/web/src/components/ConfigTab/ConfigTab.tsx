import { GoalEditor } from './GoalEditor';
import { ReviewerModelPicker } from './ReviewerModelPicker';
import { ImportPanel } from './ImportPanel';

interface ConfigTabProps {
  projectId: string;
}

export function ConfigTab({ projectId }: ConfigTabProps) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(300px, 2fr) minmax(260px, 1fr)', gap: '1.5rem' }}>
        <GoalEditor projectId={projectId} />
        <ReviewerModelPicker projectId={projectId} />
      </div>
      <ImportPanel projectId={projectId} />
    </div>
  );
}
