import 'dotenv/config';
import http from 'node:http';
import express from 'express';
import cors from 'cors';
import cron from 'node-cron';
import { Server as SocketIOServer } from 'socket.io';
import { refreshAllDevelopers } from './services/developerRefresher.js';
import epicsRouter from './routes/epics.js';
import developersRouter from './routes/developers.js';
import assignmentRouter from './routes/assignment.js';
import jiraRouter from './routes/jira.js';
import syncRouter from './routes/sync.js';
import standupRouter from './routes/standup.js';
import dbRouter from './routes/db.js';
import { ping as pingDb } from './db.js';
import { setIo } from './io.js';

const app = express();
const PORT = process.env.PORT || 3003;

// Middleware — restrict CORS to known dev/prod origins instead of wildcard
const allowedOrigins = (process.env.CORS_ORIGINS || 'http://localhost:5173,http://localhost:3003')
  .split(',').map(o => o.trim());
app.use(cors({
  origin: (origin, cb) => {
    // Allow tools like curl/Postman (no origin) and whitelisted origins
    if (!origin || allowedOrigins.includes(origin)) return cb(null, true);
    cb(new Error(`CORS: origin ${origin} not allowed`));
  },
  credentials: true,
}));
app.use(express.json({ limit: '50mb' }));

// Routes
app.use('/api', epicsRouter);
app.use('/api', developersRouter);
app.use('/api', assignmentRouter);
app.use('/api', jiraRouter);
app.use('/api', syncRouter);
app.use('/api', standupRouter);
app.use('/api', dbRouter);

// Health check
app.get('/api/health', (req, res) => {
  res.json({
    status: 'running',
    service: 'Epic Dev Assignment Backend',
    version: '1.0.0',
    timestamp: new Date().toISOString()
  });
});

// Create HTTP server so Socket.io can piggyback on the same port
const httpServer = http.createServer(app);

const io = new SocketIOServer(httpServer, {
  cors: { origin: allowedOrigins, credentials: true },
});

io.on('connection', (socket) => {
  // Clients join a project room by Jira project key to receive realtime updates
  socket.on('join', (projectKey) => {
    if (typeof projectKey === 'string' && /^[A-Z][A-Z0-9]{1,9}$/.test(projectKey.toUpperCase())) {
      socket.join(`project:${projectKey.toUpperCase()}`);
    }
  });
  socket.on('leave', (projectKey) => {
    if (typeof projectKey === 'string') socket.leave(`project:${projectKey.toUpperCase()}`);
  });
});

setIo(io);

httpServer.listen(PORT, async () => {
  console.log(`✅ Backend server running on http://localhost:${PORT}`);
  console.log(`📡 API endpoints available at http://localhost:${PORT}/api`);
  console.log(`🔌 Socket.io listening on http://localhost:${PORT}`);
  const dbOk = await pingDb();
  console.log(dbOk ? '🗄️  PostgreSQL: connected' : '⚠️  PostgreSQL: unreachable (set DATABASE_URL in .env)');

  // Daily developer roster refresh — re-fetches each developer's GitHub stats at 03:00.
  // Override with DEV_REFRESH_CRON env var, e.g. "0 */6 * * *" for every 6 hours.
  if (dbOk) {
    const schedule = process.env.DEV_REFRESH_CRON || '0 3 * * *';
    cron.schedule(schedule, () => {
      refreshAllDevelopers().catch(err => console.error('[DevRefresh] cron failed:', err.message));
    });
    console.log(`⏰ Developer refresh scheduled: "${schedule}"`);
  }
});
