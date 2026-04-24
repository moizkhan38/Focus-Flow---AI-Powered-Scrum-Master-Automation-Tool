import { useState, useCallback } from 'react';

const STORAGE_KEY = 'focus-flow-retros';

function loadRetros() {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    return stored ? JSON.parse(stored) : {};
  } catch {
    return {};
  }
}

function saveRetros(retros) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(retros));
}

/**
 * Sprint retrospective notes per project.
 * Data shape: { [projectId]: { wentWell: string[], toImprove: string[], actionItems: string[], createdAt, updatedAt } }
 */
export function useRetro() {
  const [retros, setRetros] = useState(() => loadRetros());

  const persist = useCallback((updated) => {
    setRetros(updated);
    saveRetros(updated);
  }, []);

  const getRetro = useCallback(
    (projectId) => retros[projectId] || null,
    [retros]
  );

  const saveRetro = useCallback(
    (projectId, data) => {
      const updated = {
        ...retros,
        [projectId]: {
          ...data,
          updatedAt: new Date().toISOString(),
          createdAt: retros[projectId]?.createdAt || new Date().toISOString(),
        },
      };
      persist(updated);
    },
    [retros, persist]
  );

  const deleteRetro = useCallback(
    (projectId) => {
      const updated = { ...retros };
      delete updated[projectId];
      persist(updated);
    },
    [retros, persist]
  );

  return { retros, getRetro, saveRetro, deleteRetro };
}
