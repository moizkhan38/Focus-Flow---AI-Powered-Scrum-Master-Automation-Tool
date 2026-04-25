import { query } from '../db.js';
import { analyzeDeveloper } from './githubService.js';

/**
 * Re-fetch each developer's GitHub data and update Postgres.
 * Returns a summary { total, updated, failed, errors[] }.
 */
export async function refreshAllDevelopers() {
  const startedAt = new Date();
  console.log(`[DevRefresh] Starting daily developer refresh at ${startedAt.toISOString()}`);

  let total = 0, updated = 0, failed = 0;
  const errors = [];

  try {
    const { rows: devs } = await query(
      `SELECT username, jira_username FROM developers ORDER BY updated_at ASC`
    );
    total = devs.length;
    console.log(`[DevRefresh] Found ${total} developer(s) to refresh`);

    for (const dev of devs) {
      try {
        const fresh = await analyzeDeveloper(dev.username, dev.username, undefined);
        if (!fresh || fresh.error) {
          throw new Error(fresh?.error || 'analysis returned no data');
        }

        // Upsert — preserve user-edited jira_username and availability
        await query(
          `UPDATE developers SET
              avatar_url        = $2,
              primary_expertise = $3,
              experience_level  = $4,
              top_skills        = $5,
              analysis          = $6
           WHERE username = $1`,
          [
            dev.username,
            fresh.avatar || `https://avatars.githubusercontent.com/${dev.username}`,
            fresh.analysis?.expertise?.primary || null,
            fresh.analysis?.experienceLevel?.level || null,
            (fresh.analysis?.expertise?.technologies || []).slice(0, 6),
            fresh.analysis || null,
          ]
        );
        updated++;
        console.log(`[DevRefresh] ✓ ${dev.username} — ${fresh.analysis?.totalCommits || 0} commits`);
      } catch (err) {
        failed++;
        errors.push({ username: dev.username, error: err.message });
        console.warn(`[DevRefresh] ✗ ${dev.username}: ${err.message}`);
      }
    }
  } catch (err) {
    console.error(`[DevRefresh] Fatal:`, err.message);
    errors.push({ username: '*', error: err.message });
  }

  const ms = Date.now() - startedAt.getTime();
  console.log(`[DevRefresh] Done in ${ms}ms — total=${total} updated=${updated} failed=${failed}`);
  return { total, updated, failed, errors, ranAt: startedAt.toISOString(), durationMs: ms };
}
