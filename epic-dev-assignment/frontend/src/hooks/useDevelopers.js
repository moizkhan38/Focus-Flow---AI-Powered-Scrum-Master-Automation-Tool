import { useState, useCallback } from 'react';

const STORAGE_KEY = 'focus-flow-developers';

function loadDevelopers() {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    return stored ? JSON.parse(stored) : [];
  } catch {
    return [];
  }
}

function saveDevelopers(devs) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(devs));
}

/**
 * Persistent developer roster stored in localStorage.
 * Each developer: { username, jiraUsername, avatar, primary_expertise, experience_level, top_skills, analysis, addedAt }
 */
export function useDevelopers() {
  // Synchronous init — reads localStorage immediately so no component ever
  // sees an empty roster and accidentally overwrites it before the load settles.
  const [developers, setDevelopers] = useState(() => loadDevelopers());
  const isLoaded = true;

  const persist = useCallback((updated) => {
    setDevelopers(updated);
    saveDevelopers(updated);
  }, []);

  const addDeveloper = useCallback(
    (dev) => {
      const exists = developers.find((d) => d.username === dev.username);
      if (exists) {
        // Merge — update analysis but keep jiraUsername if already set
        const updated = developers.map((d) =>
          d.username === dev.username
            ? { ...d, ...dev, jiraUsername: d.jiraUsername || dev.jiraUsername || '' }
            : d
        );
        persist(updated);
      } else {
        persist([...developers, { ...dev, jiraUsername: dev.jiraUsername || '', addedAt: new Date().toISOString() }]);
      }
    },
    [developers, persist]
  );

  const addDevelopers = useCallback(
    (devs) => {
      let updated = [...developers];
      for (const dev of devs) {
        const idx = updated.findIndex((d) => d.username === dev.username);
        if (idx >= 0) {
          updated[idx] = { ...updated[idx], ...dev, jiraUsername: updated[idx].jiraUsername || dev.jiraUsername || '' };
        } else {
          updated.push({ ...dev, jiraUsername: dev.jiraUsername || '', addedAt: new Date().toISOString() });
        }
      }
      persist(updated);
    },
    [developers, persist]
  );

  const updateJiraUsername = useCallback(
    (username, jiraUsername) => {
      const updated = developers.map((d) =>
        d.username === username ? { ...d, jiraUsername } : d
      );
      persist(updated);
    },
    [developers, persist]
  );

  const updateAvailability = useCallback(
    (username, availability) => {
      // availability: { status: 'available'|'busy'|'on-leave', capacity: 0-100 }
      const updated = developers.map((d) =>
        d.username === username ? { ...d, availability: { ...d.availability, ...availability } } : d
      );
      persist(updated);
    },
    [developers, persist]
  );

  const removeDeveloper = useCallback(
    (username) => {
      persist(developers.filter((d) => d.username !== username));
    },
    [developers, persist]
  );

  const getDeveloper = useCallback(
    (username) => developers.find((d) => d.username === username) || null,
    [developers]
  );

  return {
    developers,
    isLoaded,
    addDeveloper,
    addDevelopers,
    updateJiraUsername,
    updateAvailability,
    removeDeveloper,
    getDeveloper,
  };
}
