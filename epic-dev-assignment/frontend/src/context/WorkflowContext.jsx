import { createContext, useContext, useState, useEffect } from 'react';

// Strip markdown formatting from LLM output
function stripMd(text) {
  if (!text || typeof text !== 'string') return text;
  return text
    .replace(/\*\*\*(.+?)\*\*\*/g, '$1')
    .replace(/\*\*(.+?)\*\*/g, '$1')
    .replace(/\*(.+?)\*/g, '$1')
    .replace(/^#{1,6}\s*/gm, '')
    .replace(/`([^`]+)`/g, '$1')
    .replace(/^[-*_]{3,}\s*$/gm, '');
}

// Recursively clean all string values in an object/array
function cleanLLMData(data) {
  if (typeof data === 'string') return stripMd(data);
  if (Array.isArray(data)) return data.map(cleanLLMData);
  if (data && typeof data === 'object') {
    const cleaned = {};
    for (const [key, value] of Object.entries(data)) {
      cleaned[key] = cleanLLMData(value);
    }
    return cleaned;
  }
  return data;
}

// Safe fetch + JSON parse (handles empty/non-JSON responses)
async function safeFetchJson(url, options) {
  const res = await fetch(url, options);
  const text = await res.text();
  if (!text) return { success: false, error: 'Empty response from server. Please try again.' };
  try { return JSON.parse(text); } catch { return { success: false, error: 'Invalid response from server. Please try again.' }; }
}

const WorkflowContext = createContext(null);

export function WorkflowProvider({ children }) {
  // Load state from localStorage
  const loadState = () => {
    try {
      const saved = localStorage.getItem('epic-workflow-state');
      if (saved) {
        return JSON.parse(saved);
      }
    } catch (error) {
      console.error('Error loading state:', error);
    }
    return null;
  };

  const initialState = loadState() || {
    currentStep: 1,
    projectDescription: '',
    generatedEpics: [],
    approvedEpics: [],
    developers: [],
    assignments: [],
    workloadDistribution: {},
    generatorUsed: ''
  };

  const [state, setState] = useState(initialState);

  // Auto-save to localStorage
  useEffect(() => {
    localStorage.setItem('epic-workflow-state', JSON.stringify(state));
  }, [state]);

  const actions = {
    // Navigation
    setCurrentStep: (step) => {
      setState(prev => ({ ...prev, currentStep: step }));
    },

    nextStep: () => {
      setState(prev => ({
        ...prev,
        currentStep: Math.min(4, prev.currentStep + 1)
      }));
    },

    previousStep: () => {
      setState(prev => ({
        ...prev,
        currentStep: Math.max(1, prev.currentStep - 1)
      }));
    },

    // Step 1: Epic Generation
    setProjectDescription: (description) => {
      setState(prev => ({ ...prev, projectDescription: description }));
    },

    setGeneratedEpics: (epics, generatorUsed) => {
      setState(prev => ({
        ...prev,
        generatedEpics: cleanLLMData(epics),
        generatorUsed: generatorUsed || prev.generatorUsed,
        approvedEpics: [],
        assignments: [],
        workloadDistribution: {}
      }));
    },

    // Step 2: Epic Approval
    approveEpic: (epicIndex) => {
      setState(prev => ({
        ...prev,
        generatedEpics: prev.generatedEpics.map((epic, ei) => {
          if (ei !== epicIndex) return epic;
          return {
            ...epic,
            approved: true,
            user_stories: (epic.user_stories || []).map(story => ({
              ...story,
              approved: true,
              ac_approved: true,
              test_cases: (story.test_cases || []).map(tc => ({ ...tc, approved: true }))
            }))
          };
        })
      }));
    },

    approveStory: (epicIndex, storyIndex) => {
      setState(prev => ({
        ...prev,
        generatedEpics: prev.generatedEpics.map((epic, ei) => {
          if (ei !== epicIndex) return epic;
          return {
            ...epic,
            user_stories: epic.user_stories.map((story, si) => {
              if (si !== storyIndex) return story;
              return {
                ...story,
                approved: true,
                ac_approved: true,
                test_cases: (story.test_cases || []).map(tc => ({ ...tc, approved: true }))
              };
            })
          };
        })
      }));
    },

    approveAC: (epicIndex, storyIndex) => {
      setState(prev => ({
        ...prev,
        generatedEpics: prev.generatedEpics.map((epic, ei) => {
          if (ei !== epicIndex) return epic;
          return {
            ...epic,
            user_stories: epic.user_stories.map((story, si) => {
              if (si !== storyIndex) return story;
              return { ...story, ac_approved: true };
            })
          };
        })
      }));
    },

    approveTestCase: (epicIndex, storyIndex, tcIndex) => {
      setState(prev => ({
        ...prev,
        generatedEpics: prev.generatedEpics.map((epic, ei) => {
          if (ei !== epicIndex) return epic;
          return {
            ...epic,
            user_stories: epic.user_stories.map((story, si) => {
              if (si !== storyIndex) return story;
              return {
                ...story,
                test_cases: story.test_cases.map((tc, ti) => {
                  if (ti !== tcIndex) return tc;
                  return { ...tc, approved: true };
                })
              };
            })
          };
        })
      }));
    },

    cancelEpic: (epicIndex) => {
      setState(prev => {
        const epics = prev.generatedEpics.filter((_, i) => i !== epicIndex);
        return { ...prev, generatedEpics: epics };
      });
    },

    // Regeneration actions
    regenerateEpic: async (epicIndex, userRequirements = '') => {
      const epic = state.generatedEpics[epicIndex];
      const data = await safeFetchJson('/api/regenerate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: 'epic',
          project_description: state.projectDescription,
          context: {
            epic_id: epic.epic_id,
            epic_title: epic.epic_title,
            epic_description: epic.epic_description,
            user_requirements: userRequirements
          }
        })
      });
      if (data.success) {
        const cleaned = cleanLLMData(data.data);
        setState(prev => ({
          ...prev,
          generatedEpics: prev.generatedEpics.map((epic, ei) => {
            if (ei !== epicIndex) return epic;
            return {
              ...cleaned,
              approved: false,
              user_stories: (cleaned.user_stories || []).map(s => ({
                ...s, approved: false, ac_approved: false,
                test_cases: (s.test_cases || []).map(tc => ({ ...tc, approved: false }))
              }))
            };
          })
        }));
      }
      return data;
    },

    regenerateStory: async (epicIndex, storyIndex, userRequirements = '') => {
      const epic = state.generatedEpics[epicIndex];
      const story = epic.user_stories[storyIndex];
      const data = await safeFetchJson('/api/regenerate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: 'story',
          project_description: state.projectDescription,
          context: {
            epic_id: epic.epic_id,
            epic_title: epic.epic_title,
            epic_description: epic.epic_description,
            story_id: story.story_id,
            story_title: story.story_title,
            story_description: story.story_description,
            user_requirements: userRequirements
          }
        })
      });
      if (data.success) {
        const cleaned = cleanLLMData(data.data);
        setState(prev => ({
          ...prev,
          generatedEpics: prev.generatedEpics.map((epic, ei) => {
            if (ei !== epicIndex) return epic;
            return {
              ...epic,
              user_stories: epic.user_stories.map((story, si) => {
                if (si !== storyIndex) return story;
                return {
                  ...cleaned,
                  approved: false,
                  ac_approved: false,
                  test_cases: (cleaned.test_cases || []).map(tc => ({ ...tc, approved: false }))
                };
              })
            };
          })
        }));
      }
      return data;
    },

    regenerateAC: async (epicIndex, storyIndex, userRequirements = '') => {
      const epic = state.generatedEpics[epicIndex];
      const story = epic.user_stories[storyIndex];
      const data = await safeFetchJson('/api/regenerate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: 'acceptance_criteria',
          project_description: state.projectDescription,
          context: {
            epic_id: epic.epic_id,
            epic_title: epic.epic_title,
            epic_description: epic.epic_description,
            story_id: story.story_id,
            story_title: story.story_title,
            story_description: story.story_description,
            user_requirements: userRequirements
          }
        })
      });
      if (data.success) {
        const cleaned = cleanLLMData(data.data);
        setState(prev => ({
          ...prev,
          generatedEpics: prev.generatedEpics.map((epic, ei) => {
            if (ei !== epicIndex) return epic;
            return {
              ...epic,
              user_stories: epic.user_stories.map((story, si) => {
                if (si !== storyIndex) return story;
                return { ...story, acceptance_criteria: cleaned, ac_approved: false };
              })
            };
          })
        }));
      }
      return data;
    },

    regenerateTestCase: async (epicIndex, storyIndex, tcIndex, userRequirements = '') => {
      const epic = state.generatedEpics[epicIndex];
      const story = epic.user_stories[storyIndex];
      const tc = story.test_cases[tcIndex];
      const data = await safeFetchJson('/api/regenerate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: 'test_case',
          project_description: state.projectDescription,
          context: {
            epic_id: epic.epic_id,
            epic_title: epic.epic_title,
            epic_description: epic.epic_description,
            story_id: story.story_id,
            story_title: story.story_title,
            story_description: story.story_description,
            test_case_id: tc.test_case_id,
            test_case_description: tc.test_case_description,
            user_requirements: userRequirements
          }
        })
      });
      if (data.success) {
        const cleaned = cleanLLMData(data.data);
        setState(prev => ({
          ...prev,
          generatedEpics: prev.generatedEpics.map((epic, ei) => {
            if (ei !== epicIndex) return epic;
            return {
              ...epic,
              user_stories: epic.user_stories.map((story, si) => {
                if (si !== storyIndex) return story;
                return {
                  ...story,
                  test_cases: story.test_cases.map((tc, ti) => {
                    if (ti !== tcIndex) return tc;
                    return { ...cleaned, approved: false };
                  })
                };
              })
            };
          })
        }));
      }
      return data;
    },

    setApprovedEpics: (epics) => {
      setState(prev => ({ ...prev, approvedEpics: epics }));
    },

    // Step 3: Developer Analysis
    setDevelopers: (developers) => {
      setState(prev => ({ ...prev, developers }));
    },

    addDeveloper: (developer) => {
      setState(prev => ({
        ...prev,
        developers: [...prev.developers, developer]
      }));
    },

    removeDeveloper: (index) => {
      setState(prev => ({
        ...prev,
        developers: prev.developers.filter((_, i) => i !== index)
      }));
    },

    // Step 4: Assignment
    setAssignments: (assignments, workloadDistribution) => {
      setState(prev => ({
        ...prev,
        assignments,
        workloadDistribution: workloadDistribution || prev.workloadDistribution
      }));
    },

    reassignEpic: (epicId, newDeveloperUsername) => {
      setState(prev => {
        const assignmentIndex = prev.assignments.findIndex(a => a.epic.epic_id === epicId);
        if (assignmentIndex === -1) return prev;

        const oldAssignment = prev.assignments[assignmentIndex];
        const oldDev = oldAssignment.developer.username;
        const storyPoints = oldAssignment.epic.totalStoryPoints;
        const newDev = prev.developers.find(d => d.username === newDeveloperUsername);
        if (!newDev) return prev;

        // Recalculate expertise match for the new developer
        const epicType = oldAssignment.epic.classification?.primary || "Full Stack";
        const allExpertise = newDev.analysis?.expertise?.all || [];
        const expertiseMatch = allExpertise.find(e => e.name === epicType);
        const maxScore = Math.max(...allExpertise.map(e => e.score), 1);

        let expertisePoints = 0;
        if (expertiseMatch) {
          expertisePoints = Math.round((expertiseMatch.score / maxScore) * 50);
        } else if (newDev.analysis?.expertise?.primary === "Full Stack") {
          expertisePoints = Math.min(30, Math.round((allExpertise.length / 5) * 30));
        }

        const experienceMap = { "Senior": 30, "Mid-Level": 20, "Junior": 10, "Beginner": 5 };
        const experiencePoints = experienceMap[newDev.analysis?.experienceLevel?.level] || 5;
        const recalcScore = expertisePoints + experiencePoints;
        const hasExpertise = expertisePoints > 0;

        const newAssignments = prev.assignments.map((a, i) => {
          if (i !== assignmentIndex) return a;
          return {
            ...a,
            developer: {
              username: newDev.username,
              expertise: newDev.analysis.expertise.primary,
              experienceLevel: newDev.analysis.experienceLevel.level,
              avatar: newDev.avatar
            },
            score: recalcScore,
            breakdown: {
              expertiseMatch: expertisePoints,
              experienceLevel: experiencePoints,
              workloadBalance: 0
            },
            confidence: hasExpertise ? "manual-verified" : "manual"
          };
        });

        return {
          ...prev,
          assignments: newAssignments,
          workloadDistribution: {
            ...prev.workloadDistribution,
            [oldDev]: (prev.workloadDistribution[oldDev] || 0) - storyPoints,
            [newDeveloperUsername]: (prev.workloadDistribution[newDeveloperUsername] || 0) + storyPoints
          }
        };
      });
    },

    // Reset
    reset: () => {
      localStorage.removeItem('epic-workflow-state');
      setState({
        currentStep: 1,
        projectDescription: '',
        generatedEpics: [],
        approvedEpics: [],
        developers: [],
        assignments: [],
        workloadDistribution: {},
        generatorUsed: ''
      });
    }
  };

  return (
    <WorkflowContext.Provider value={{ ...state, ...actions }}>
      {children}
    </WorkflowContext.Provider>
  );
}

export function useWorkflow() {
  const context = useContext(WorkflowContext);
  if (!context) {
    throw new Error('useWorkflow must be used within WorkflowProvider');
  }
  return context;
}
