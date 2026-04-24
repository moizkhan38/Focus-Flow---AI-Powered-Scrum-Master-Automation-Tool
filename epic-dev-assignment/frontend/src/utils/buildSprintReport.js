export function buildSprintReport(issues, sprint, healthScore) {
  const doneIssues = (issues || []).filter(i => {
    const s = (i.status || '').toLowerCase();
    return s.includes('done') || s.includes('closed') || s.includes('resolved');
  });

  const allIssues = issues || [];
  const completedPoints = doneIssues.reduce((s, i) => s + (i.storyPoints || 0), 0);
  const totalPoints = allIssues.reduce((s, i) => s + (i.storyPoints || 0), 0);

  const issuesByType = {};
  const issuesByPriority = {};
  const issuesByAssignee = {};
  for (const i of allIssues) {
    issuesByType[i.issueType || 'Unknown'] = (issuesByType[i.issueType || 'Unknown'] || 0) + 1;
    issuesByPriority[i.priority || 'None'] = (issuesByPriority[i.priority || 'None'] || 0) + 1;
    const name = i.assignee?.name || 'Unassigned';
    issuesByAssignee[name] = (issuesByAssignee[name] || 0) + 1;
  }

  return {
    sprint: {
      name: sprint?.name || 'Sprint',
      startDate: sprint?.startDate,
      endDate: sprint?.endDate,
    },
    completedIssues: doneIssues.length,
    totalIssues: allIssues.length,
    completedPoints,
    totalPoints,
    completionRate: allIssues.length > 0 ? Math.round((doneIssues.length / allIssues.length) * 100) : 0,
    healthScore: healthScore || { score: 0, level: 'unknown' },
    issuesByType,
    issuesByPriority,
    issuesByAssignee,
    issues: allIssues.map(i => ({
      key: i.key,
      summary: i.summary,
      issueType: i.issueType,
      status: i.status,
      priority: i.priority,
      assignee: i.assignee,
      storyPoints: i.storyPoints,
    })),
  };
}
