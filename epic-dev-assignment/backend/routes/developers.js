import express from 'express';
import { analyzeDeveloper } from '../services/githubService.js';

const router = express.Router();

// POST /api/analyze-developers - Analyze multiple developers
// Accepts either:
//   { developers: [{ username, owner?, repo? }] }
//   { github_usernames: ["user1", "user2"] }
router.post('/analyze-developers', async (req, res) => {
  try {
    let devList = req.body.developers;

    // Support simple string array from frontend
    if (!devList && Array.isArray(req.body.github_usernames)) {
      devList = req.body.github_usernames.map((u) => ({ username: u }));
    }

    if (!devList || !Array.isArray(devList)) {
      return res.status(400).json({
        success: false,
        error: 'developers array or github_usernames array is required'
      });
    }

    // Analyze all developers in parallel for speed
    const results = await Promise.all(
      devList
        .filter((dev) => {
          const username = typeof dev === 'string' ? dev : dev.username;
          return username && username.trim();
        })
        .map(async (dev) => {
          const username = typeof dev === 'string' ? dev : dev.username;
          try {
            return await analyzeDeveloper(
              username,
              dev.owner || username,
              dev.repo
            );
          } catch (error) {
            console.error(`Error analyzing ${username}:`, error);
            return { username, error: error.message };
          }
        })
    );

    // Flatten nested analysis fields so frontend can use dev.login, dev.primary_expertise, etc.
    const devs = results.filter(r => !r.error).map(r => ({
      ...r,
      login: r.username,
      avatar_url: r.avatar || `https://avatars.githubusercontent.com/${r.username}`,
      primary_expertise: r.analysis?.expertise?.primary || 'Full Stack',
      experience_level: r.analysis?.experienceLevel?.level || 'Junior',
      top_skills: (r.analysis?.expertise?.technologies || []).slice(0, 6),
    }));

    if (devs.length === 0 && devList.length > 0) {
      return res.status(422).json({
        success: false,
        error: 'All developer analyses failed. Check GitHub usernames and try again.',
        failedUsernames: results.filter(r => r.error).map(r => r.username)
      });
    }

    res.json({
      success: true,
      developers: devs
    });
  } catch (error) {
    console.error('Error analyzing developers:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to analyze developers'
    });
  }
});

export default router;
