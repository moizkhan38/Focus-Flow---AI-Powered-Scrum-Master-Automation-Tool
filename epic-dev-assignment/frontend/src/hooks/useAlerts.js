import { useState, useMemo } from 'react';

export function useAlerts(issues) {
  const [dismissed, setDismissed] = useState(new Set());

  const allAlerts = useMemo(() => {
    if (!issues || issues.length === 0) return [];
    const alerts = [];

    const blockers = issues.filter(
      (i) => i.priority === 'Blocker' || i.priority === 'Critical' || i.labels?.includes('blocker')
    );
    if (blockers.length > 0) {
      alerts.push({
        id: 'blockers',
        type: 'blocker',
        title: `${blockers.length} Blocker${blockers.length > 1 ? 's' : ''} Detected`,
        message: blockers.map((b) => b.summary).join(', '),
        severity: 'high',
      });
    }

    const bugs = issues.filter((i) => i.issueType === 'Bug');
    if (bugs.length > 0) {
      alerts.push({
        id: 'bugs',
        type: 'bug',
        title: `${bugs.length} Bug${bugs.length > 1 ? 's' : ''} in Sprint`,
        message: bugs.map((b) => b.summary).join(', '),
        severity: 'medium',
      });
    }

    const scopeChanges = issues.filter(
      (i) => i.labels?.includes('scope-change') || i.labels?.includes('added-to-sprint')
    );
    if (scopeChanges.length > 0) {
      alerts.push({
        id: 'scope',
        type: 'scope',
        title: `${scopeChanges.length} Scope Change${scopeChanges.length > 1 ? 's' : ''}`,
        message: 'Issues were added after sprint started.',
        severity: 'low',
      });
    }

    return alerts;
  }, [issues]);

  const alerts = allAlerts.filter((a) => !dismissed.has(a.id));

  const dismissAlert = (id) => setDismissed((prev) => new Set([...prev, id]));
  const dismissAll = () => setDismissed(new Set(allAlerts.map((a) => a.id)));

  return { alerts, allAlerts, dismissAlert, dismissAll };
}
