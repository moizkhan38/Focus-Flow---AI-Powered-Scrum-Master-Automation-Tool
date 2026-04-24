import { useState, useCallback } from 'react';

const STORAGE_KEY = 'focus-flow-templates';

function loadTemplates() {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    return stored ? JSON.parse(stored) : [];
  } catch {
    return [];
  }
}

function saveTemplates(templates) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(templates));
}

/**
 * Manage project templates — save a project's epics/stories as a reusable template.
 * Template: { id, name, description, epics, createdAt }
 */
export function useTemplates() {
  const [templates, setTemplates] = useState(() => loadTemplates());

  const persist = useCallback((updated) => {
    setTemplates(updated);
    saveTemplates(updated);
  }, []);

  const saveAsTemplate = useCallback(
    (project) => {
      const template = {
        id: `tpl-${Date.now()}`,
        name: project.name || 'Untitled Template',
        description: project.rawText || project.description || '',
        epicCount: project.epics?.length || 0,
        storyCount: project.epics?.reduce((s, e) => s + (e.stories?.length || 0), 0) || 0,
        totalPoints: project.epics?.reduce((s, e) =>
          s + (e.stories?.reduce((ss, st) => ss + (st.storyPoints || 0), 0) || 0), 0) || 0,
        epics: (project.epics || []).map((e) => ({
          id: e.id,
          title: e.title,
          description: e.description || '',
          status: 'approved',
          stories: (e.stories || []).map((s) => ({
            id: s.id,
            title: s.title,
            description: s.description || '',
            acceptanceCriteria: s.acceptanceCriteria || '',
            storyPoints: s.storyPoints || 0,
            status: 'approved',
          })),
        })),
        createdAt: new Date().toISOString(),
      };
      persist([template, ...templates]);
      return template;
    },
    [templates, persist]
  );

  const deleteTemplate = useCallback(
    (templateId) => {
      persist(templates.filter((t) => t.id !== templateId));
    },
    [templates, persist]
  );

  const getTemplate = useCallback(
    (templateId) => templates.find((t) => t.id === templateId) || null,
    [templates]
  );

  return { templates, saveAsTemplate, deleteTemplate, getTemplate };
}
