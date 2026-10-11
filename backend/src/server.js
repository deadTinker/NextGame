import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import pg from 'pg';

const { Pool } = pg;
const app = express();
const port = Number(process.env.PORT || 4000);
const jwtSecret = process.env.JWT_SECRET;
const clientOrigin = process.env.CLIENT_ORIGIN || 'http://localhost:5173';

if (!process.env.DATABASE_URL) throw new Error('DATABASE_URL is required. Copy .env.example to .env and configure PostgreSQL.');
if (!jwtSecret || jwtSecret.length < 32) throw new Error('JWT_SECRET must be set to a random string of at least 32 characters.');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.DATABASE_URL.includes('localhost') || process.env.DATABASE_URL.includes('127.0.0.1')
    ? false
    : { rejectUnauthorized: false },
});

app.use(helmet());
app.use(cors({ origin: clientOrigin.split(',').map((origin) => origin.trim()), credentials: false }));
app.use(express.json({ limit: '1mb' }));

const authLimiter = rateLimit({ windowMs: 15 * 60 * 1000, limit: 30, standardHeaders: 'draft-7', legacyHeaders: false });

function createToken(user) {
  return jwt.sign({ sub: String(user.id), email: user.email }, jwtSecret, { expiresIn: '7d' });
}

function requireAuth(req, res, next) {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : '';
  if (!token) return res.status(401).json({ error: 'Authentication required.' });
  try {
    const payload = jwt.verify(token, jwtSecret);
    req.user = { id: String(payload.sub), email: payload.email };
    next();
  } catch {
    return res.status(401).json({ error: 'Session expired or invalid. Please sign in again.' });
  }
}

function validateEmail(email) {
  return typeof email === 'string' && email.length <= 254 && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

app.get('/api/health', async (_req, res) => {
  try {
    await pool.query('SELECT 1');
    res.json({ ok: true, database: 'connected' });
  } catch {
    res.status(503).json({ ok: false, database: 'unavailable' });
  }
});

app.post('/api/auth/signup', authLimiter, async (req, res, next) => {
  try {
    const email = typeof req.body?.email === 'string' ? req.body.email.trim().toLowerCase() : '';
    const password = typeof req.body?.password === 'string' ? req.body.password : '';
    if (!validateEmail(email)) return res.status(400).json({ error: 'Enter a valid email address.' });
    if (password.length < 8 || password.length > 72) return res.status(400).json({ error: 'Password must be between 8 and 72 characters.' });

    const passwordHash = await bcrypt.hash(password, 12);
    const result = await pool.query(
      'INSERT INTO users (email, password_hash) VALUES ($1, $2) RETURNING id, email',
      [email, passwordHash],
    );
    const user = result.rows[0];
    res.status(201).json({ token: createToken(user), user: { id: String(user.id), email: user.email } });
  } catch (error) {
    if (error?.code === '23505') return res.status(409).json({ error: 'An account with this email already exists.' });
    next(error);
  }
});

app.post('/api/auth/login', authLimiter, async (req, res, next) => {
  try {
    const email = typeof req.body?.email === 'string' ? req.body.email.trim().toLowerCase() : '';
    const password = typeof req.body?.password === 'string' ? req.body.password : '';
    if (!validateEmail(email) || !password) return res.status(400).json({ error: 'Enter your email and password.' });
    const result = await pool.query('SELECT id, email, password_hash FROM users WHERE email = $1', [email]);
    const user = result.rows[0];
    if (!user || !(await bcrypt.compare(password, user.password_hash))) {
      return res.status(401).json({ error: 'Incorrect email or password.' });
    }
    res.json({ token: createToken(user), user: { id: String(user.id), email: user.email } });
  } catch (error) { next(error); }
});

app.get('/api/sync', requireAuth, async (req, res, next) => {
  try {
    const result = await pool.query('SELECT state, updated_at FROM user_state WHERE user_id = $1', [req.user.id]);
    if (!result.rows[0]) return res.json({ state: null, updatedAt: null });
    res.json({ state: result.rows[0].state, updatedAt: result.rows[0].updated_at });
  } catch (error) { next(error); }
});

app.put('/api/sync', requireAuth, async (req, res, next) => {
  try {
    const state = req.body?.state;
    if (!state || typeof state !== 'object' || Array.isArray(state)) {
      return res.status(400).json({ error: 'A state object is required.' });
    }
    const allowed = ['activeGame', 'tasks', 'completedGames'];
    if (!allowed.every((key) => Object.hasOwn(state, key))) {
      return res.status(400).json({ error: 'State must include activeGame, tasks, and completedGames.' });
    }
    if (!Array.isArray(state.tasks) || !Array.isArray(state.completedGames) || state.completedGames.length > 5000 || state.tasks.length > 500) {
      return res.status(400).json({ error: 'The supplied game state is invalid or too large.' });
    }
    const result = await pool.query(
      `INSERT INTO user_state (user_id, state, updated_at)
       VALUES ($1, $2::jsonb, NOW())
       ON CONFLICT (user_id) DO UPDATE SET state = EXCLUDED.state, updated_at = NOW()
       RETURNING updated_at`,
      [req.user.id, JSON.stringify({ activeGame: state.activeGame, tasks: state.tasks, completedGames: state.completedGames })],
    );
    res.json({ ok: true, updatedAt: result.rows[0].updated_at });
  } catch (error) { next(error); }
});

app.use((error, _req, res, _next) => {
  console.error(error);
  res.status(500).json({ error: 'An unexpected server error occurred.' });
});

app.listen(port, () => console.log(`NextQuest API listening on http://localhost:${port}`));
