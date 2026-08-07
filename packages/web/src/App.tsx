import { useEffect, useState } from 'react';
import type { ProjectRegistryEntry } from '@gauntlet-wrapper/shared';
import { ProjectRegisterForm } from './components/ProjectRegisterForm';
import { XtermPane } from './components/Terminal/XtermPane';
import { ReferencesTab } from './components/ReferencesTab/ReferencesTab';
import { ConfigTab } from './components/ConfigTab/ConfigTab';
import { ProgressTab } from './components/ProgressTab/ProgressTab';
import { NotificationBanner } from './components/NotificationBanner/NotificationBanner';

type TabId = 'session' | 'references' | 'progress' | 'config';
const TABS: { id: TabId; label: string }[] = [
  { id: 'session', label: 'Session' },
  { id: 'references', label: 'References' },
  { id: 'progress', label: 'Progress' },
  { id: 'config', label: 'Config' },
];

export function App() {
  const [projects, setProjects] = useState<ProjectRegistryEntry[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<TabId>('session');

  useEffect(() => {
    fetch('/api/projects')
      .then((res) => res.json())
      .then((entries: ProjectRegistryEntry[]) => {
        setProjects(entries);
        if (entries.length > 0) setSelectedId(entries[0].id);
      })
      .catch(() => {});
  }, []);

  const handleRegistered = (project: ProjectRegistryEntry) => {
    setProjects((prev) => (prev.some((p) => p.id === project.id) ? prev : [...prev, project]));
    setSelectedId(project.id);
  };

  return (
    <main
      style={{
        fontFamily: 'system-ui',
        color: '#e8e8e8',
        background: '#14161a',
        minHeight: '100vh',
        display: 'flex',
        flexDirection: 'column',
      }}
    >
      <NotificationBanner
        projects={projects}
        onOpenProject={(projectId) => {
          setSelectedId(projectId);
          setActiveTab('session');
        }}
      />
      <header style={{ padding: '1rem 1.5rem', borderBottom: '1px solid #333' }}>
        <h1 style={{ margin: '0 0 0.75rem 0', fontSize: '1.2rem' }}>gauntlet-wrapper</h1>
        <ProjectRegisterForm onRegistered={handleRegistered} />
        {projects.length > 0 && (
          <div style={{ marginTop: '0.75rem', display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
            {projects.map((p) => (
              <button
                key={p.id}
                onClick={() => setSelectedId(p.id)}
                style={{
                  padding: '0.3rem 0.7rem',
                  background: p.id === selectedId ? '#2d6cdf' : '#22252b',
                  color: '#e8e8e8',
                  border: '1px solid #333',
                  borderRadius: '4px',
                  cursor: 'pointer',
                }}
              >
                {p.displayName}
              </button>
            ))}
          </div>
        )}
      </header>

      {selectedId ? (
        <>
          <nav style={{ display: 'flex', gap: '0.25rem', padding: '0.75rem 1.5rem 0' }}>
            {TABS.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                style={{
                  padding: '0.4rem 1rem',
                  background: activeTab === tab.id ? '#1b1e24' : 'transparent',
                  color: '#e8e8e8',
                  border: '1px solid #333',
                  borderBottom: activeTab === tab.id ? '1px solid #1b1e24' : '1px solid #333',
                  borderRadius: '4px 4px 0 0',
                  cursor: 'pointer',
                }}
              >
                {tab.label}
              </button>
            ))}
          </nav>

          <section style={{ flex: 1, padding: '1rem 1.5rem', minHeight: 0 }}>
            {activeTab === 'session' && (
              <div style={{ height: '70vh', border: '1px solid #333', borderRadius: '4px', padding: '0.5rem' }}>
                <XtermPane key={selectedId} projectId={selectedId} />
              </div>
            )}
            {activeTab === 'references' && <ReferencesTab key={selectedId} projectId={selectedId} />}
            {activeTab === 'progress' && <ProgressTab key={selectedId} projectId={selectedId} />}
            {activeTab === 'config' && <ConfigTab key={selectedId} projectId={selectedId} />}
          </section>
        </>
      ) : (
        <section style={{ flex: 1, padding: '1rem 1.5rem' }}>
          <p>Register a target repo above to open its Claude Code session.</p>
        </section>
      )}
    </main>
  );
}
