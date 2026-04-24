import express from 'express';

const router = express.Router();
const FOCUS_FLOW_URL = process.env.FOCUS_FLOW_URL || 'http://localhost:3000';

router.post('/standup', async (req, res) => {
  try {
    const response = await fetch(`${FOCUS_FLOW_URL}/api/standup`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(req.body),
    });

    const data = await response.json();
    return res.status(response.status).json({ success: response.ok, ...data });
  } catch (error) {
    console.error('Error proxying standup request:', error);
    return res.status(500).json({ success: false, error: error.message || 'Standup proxy failed' });
  }
});

router.get('/standup/history', async (req, res) => {
  try {
    const projectKey = req.query.project_key ? `?project_key=${req.query.project_key}` : '';
    const response = await fetch(`${FOCUS_FLOW_URL}/api/standup/history${projectKey}`);
    const data = await response.json();
    return res.status(response.status).json(data);
  } catch (error) {
    console.error('Error fetching standup history:', error);
    return res.status(500).json({ success: false, error: 'Standup bot is not running or unreachable.', standups: [] });
  }
});

export default router;
