import { useCallback, useEffect, useState } from 'react';
import type { ReferencesCatalog } from '@gauntlet-wrapper/shared';
import { PhotoReferenceForm } from './PhotoReferenceForm';
import { VideoReferenceForm } from './VideoReferenceForm';
import { GameplayReferenceForm } from './GameplayReferenceForm';
import { ReferenceList } from './ReferenceList';

interface ReferencesTabProps {
  projectId: string;
}

export function ReferencesTab({ projectId }: ReferencesTabProps) {
  const [catalog, setCatalog] = useState<ReferencesCatalog | null>(null);

  const refresh = useCallback(() => {
    fetch(`/api/projects/${projectId}/references`)
      .then((res) => res.json())
      .then(setCatalog)
      .catch(() => {});
  }, [projectId]);

  useEffect(() => {
    setCatalog(null);
    refresh();
  }, [refresh]);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '1rem' }}>
        <PhotoReferenceForm projectId={projectId} onAdded={refresh} />
        <VideoReferenceForm projectId={projectId} onAdded={refresh} />
        <GameplayReferenceForm projectId={projectId} onAdded={refresh} />
      </div>
      <ReferenceList projectId={projectId} catalog={catalog} onChanged={refresh} />
    </div>
  );
}
