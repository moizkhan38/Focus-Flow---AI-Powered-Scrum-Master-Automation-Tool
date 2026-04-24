/**
 * Compute planned duration in days from a deadline object { value, unit }.
 */
export function getPlannedDurationDays(deadline) {
  if (!deadline || !deadline.value) return null;
  const v = parseInt(deadline.value);
  if (!v || v <= 0) return null;
  switch (deadline.unit) {
    case 'hours': return Math.max(1, Math.ceil(v / 24));
    case 'days': return v;
    case 'months': return v * 30;
    case 'weeks':
    default: return v * 7;
  }
}

/**
 * Compute estimation accuracy as a percentage (capped at 100).
 */
export function computeEstimationAccuracy(estimated, delivered) {
  if (!estimated || estimated === 0) return null;
  return Math.min(100, Math.round((delivered / estimated) * 100));
}

/**
 * Build the completionMetrics object persisted on the project when the last sprint closes.
 *
 * @param {object} project    - The full project object from useProjects
 * @param {object} jiraStats  - { done, total, donePoints, totalPoints, ... }
 * @param {object} healthData - { score, level, factors }
 * @param {object} sprintReport - Output of buildSprintReport()
 * @returns {object} completionMetrics
 */
export function buildCompletionMetrics(project, jiraStats, healthData, sprintReport) {
  const now = new Date();
  const created = project.createdAt ? new Date(project.createdAt) : now;
  const actualDurationDays = Math.max(1, Math.ceil((now - created) / (1000 * 60 * 60 * 24)));
  const plannedDurationDays = getPlannedDurationDays(project.deadline);

  const onTime = plannedDurationDays ? actualDurationDays <= plannedDurationDays : null;
  const delayDays = plannedDurationDays && !onTime ? actualDurationDays - plannedDurationDays : 0;

  const estimatedPoints = (project.epics || []).reduce((s, e) =>
    s + ((e.stories || []).reduce((ss, st) => ss + (st.storyPoints || 0), 0)), 0);
  const deliveredPoints = jiraStats?.donePoints || 0;
  const estimationAccuracy = computeEstimationAccuracy(estimatedPoints, deliveredPoints);

  const actualDurationWeeks = Math.max(1, actualDurationDays / 7);
  const velocity = parseFloat((deliveredPoints / actualDurationWeeks).toFixed(1));

  const team = (project.analyzedDevelopers || []).map(d => d.username);

  return {
    completedAt: now.toISOString(),
    actualDurationDays,
    plannedDurationDays,
    onTime,
    delayDays,
    finalHealthScore: healthData ? { score: healthData.score, level: healthData.level } : null,
    estimatedPoints,
    deliveredPoints,
    estimationAccuracy,
    totalStories: jiraStats?.total || 0,
    completedStories: jiraStats?.done || 0,
    velocity,
    sprintCount: project.sprintCount || 1,
    teamSize: team.length,
    team,
    sprintReport: sprintReport || null,
  };
}
