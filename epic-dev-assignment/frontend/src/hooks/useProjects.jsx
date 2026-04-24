import { createContext, useContext, useState, useCallback, useRef } from 'react';

const STORAGE_KEY = 'focus-flow-projects';

function loadProjects() {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    return stored ? JSON.parse(stored) : [];
  } catch {
    return [];
  }
}

function saveProjects(projects) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(projects));
}

const ProjectsContext = createContext(null);

export function ProjectsProvider({ children }) {
  const [projects, setProjects] = useState(() => loadProjects());
  const projectsRef = useRef(projects);
  projectsRef.current = projects;

  const persist = useCallback((updated) => {
    setProjects(updated);
    saveProjects(updated);
  }, []);

  const addProject = useCallback(
    (project) => {
      const current = projectsRef.current;
      const updated = [project, ...current.filter(p => p.id !== project.id)];
      persist(updated);
    },
    [persist]
  );

  const getProject = useCallback(
    (id) => projectsRef.current.find((p) => p.id === id) || null,
    []
  );

  const updateProject = useCallback(
    (id, updates) => {
      const updated = projectsRef.current.map((p) => (p.id === id ? { ...p, ...updates } : p));
      persist(updated);
    },
    [persist]
  );

  const setEpics = useCallback(
    (projectId, epics) => {
      const updated = projectsRef.current.map((p) =>
        p.id === projectId ? { ...p, epics, status: 'epics-ready' } : p
      );
      persist(updated);
    },
    [persist]
  );

  const addStoriesToEpic = useCallback(
    (projectId, epicId, stories) => {
      const updated = projectsRef.current.map((p) => {
        if (p.id !== projectId) return p;
        const updatedEpics = p.epics.map((e) => (e.id === epicId ? { ...e, stories } : e));
        const allHaveStories = updatedEpics.every((e) => e.stories.length > 0);
        return { ...p, epics: updatedEpics, status: allHaveStories ? 'stories-ready' : p.status };
      });
      persist(updated);
    },
    [persist]
  );

  const updateEpicStatus = useCallback(
    (projectId, epicId, status) => {
      const updated = projectsRef.current.map((p) => {
        if (p.id !== projectId) return p;
        return { ...p, epics: p.epics.map((e) => (e.id === epicId ? { ...e, status } : e)) };
      });
      persist(updated);
    },
    [persist]
  );

  const updateStoryStatus = useCallback(
    (projectId, epicId, storyId, status) => {
      const updated = projectsRef.current.map((p) => {
        if (p.id !== projectId) return p;
        return {
          ...p,
          epics: p.epics.map((e) =>
            e.id === epicId
              ? { ...e, stories: e.stories.map((s) => (s.id === storyId ? { ...s, status } : s)) }
              : e
          ),
        };
      });
      persist(updated);
    },
    [persist]
  );

  const updateEpic = useCallback(
    (projectId, epicId, updates) => {
      const updated = projectsRef.current.map((p) => {
        if (p.id !== projectId) return p;
        return { ...p, epics: p.epics.map((e) => (e.id === epicId ? { ...e, ...updates } : e)) };
      });
      persist(updated);
    },
    [persist]
  );

  const updateStory = useCallback(
    (projectId, epicId, storyId, updates) => {
      const updated = projectsRef.current.map((p) => {
        if (p.id !== projectId) return p;
        return {
          ...p,
          epics: p.epics.map((e) =>
            e.id === epicId
              ? { ...e, stories: e.stories.map((s) => (s.id === storyId ? { ...s, ...updates } : s)) }
              : e
          ),
        };
      });
      persist(updated);
    },
    [persist]
  );

  const bulkUpdateStatus = useCallback(
    (projectId, status) => {
      const updated = projectsRef.current.map((p) => {
        if (p.id !== projectId) return p;
        return {
          ...p,
          epics: p.epics.map((e) => ({
            ...e,
            status,
            stories: e.stories.map((s) => ({ ...s, status })),
          })),
        };
      });
      persist(updated);
    },
    [persist]
  );

  const setAssignments = useCallback(
    (projectId, assignments, analyzedDevelopers) => {
      const updated = projectsRef.current.map((p) =>
        p.id === projectId ? { ...p, assignments, analyzedDevelopers, status: 'assigned' } : p
      );
      persist(updated);
    },
    [persist]
  );

  const deleteProject = useCallback(
    (projectId) => {
      const updated = projectsRef.current.filter((p) => p.id !== projectId);
      persist(updated);
    },
    [persist]
  );

  const syncJiraProgress = useCallback(
    (projectId, jiraIssues) => {
      if (!jiraIssues || jiraIssues.length === 0) return;
      let todo = 0, inProgress = 0, done = 0, donePoints = 0, totalPoints = 0;
      jiraIssues.forEach(i => {
        const s = (i.status || '').toLowerCase();
        const pts = i.storyPoints || 0;
        totalPoints += pts;
        if (s.includes('done') || s.includes('closed') || s.includes('resolved')) { done++; donePoints += pts; }
        else if (s.includes('progress') || s.includes('review')) inProgress++;
        else todo++;
      });
      const updated = projectsRef.current.map(p => {
        if (p.id !== projectId) return p;
        return {
          ...p,
          jiraProgress: {
            total: jiraIssues.length, todo, inProgress, done, donePoints, totalPoints,
            lastSynced: Date.now(),
          },
        };
      });
      persist(updated);
    },
    [persist]
  );

  const value = {
    projects,
    isLoaded: true,
    addProject,
    getProject,
    updateProject,
    setEpics,
    addStoriesToEpic,
    updateEpicStatus,
    updateStoryStatus,
    updateEpic,
    updateStory,
    bulkUpdateStatus,
    setAssignments,
    deleteProject,
    syncJiraProgress,
  };

  return <ProjectsContext.Provider value={value}>{children}</ProjectsContext.Provider>;
}

export function useProjects() {
  const ctx = useContext(ProjectsContext);
  if (!ctx) throw new Error('useProjects must be used within ProjectsProvider');
  return ctx;
}
