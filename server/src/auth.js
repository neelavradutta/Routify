import { Router } from 'express';
import Database from 'better-sqlite3';
import { mkdirSync, unlinkSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import rateLimit from 'express-rate-limit';
import { z } from 'zod';

const dataDir = join(dirname(fileURLToPath(import.meta.url)), '..', 'data');
mkdirSync(dataDir, { recursive: true });

const DEV_SECRET = 'dev-only-secret-change-me';
const secret = process.env.JWT_SECRET || DEV_SECRET;
const TTL = '7d';
const JWT_OPTS = { algorithm: 'HS256', expiresIn: TTL };
const VERIFY_OPTS = { algorithms: ['HS256'] };

if (process.env.NODE_ENV === 'production') {
  if (!process.env.JWT_SECRET || secret.length < 32 || secret === DEV_SECRET) {
    console.error('Set JWT_SECRET to a random string of at least 32 characters before running in production.');
    process.exit(1);
  }
}

const dbPath = process.env.AUTH_DB_PATH || join(dataDir, 'users.sqlite');
const db = new Database(dbPath);
db.exec(`CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  email TEXT NOT NULL UNIQUE COLLATE NOCASE,
  password_hash TEXT NOT NULL,
  full_name TEXT,
  created_at TEXT NOT NULL
)`);
try {
  db.exec('ALTER TABLE users ADD COLUMN full_name TEXT');
} catch {
  /* column already exists */
}

const DUMMY_HASH = bcrypt.hashSync('invalid-password-timing-pad', 10);

const credentials = z.object({
  email: z.string().trim().toLowerCase().email('Enter a valid email address').max(254),
  password: z.string().min(8, 'Password must be at least 8 characters').max(128, 'Password is too long'),
});

const registerBody = credentials.extend({
  fullName: z
    .string()
    .trim()
    .min(2, 'Enter your full name')
    .max(80)
    .refine((v) => !/[\x00-\x1f\x7f]/.test(v), 'Enter your full name'),
});

const sign = (user) =>
  jwt.sign({ sub: user.id, email: user.email, name: user.fullName ?? null }, secret, JWT_OPTS);

function loadUser(id) {
  return db.prepare('SELECT id, email, full_name FROM users WHERE id = ?').get(id);
}

export function requireAuth(req, res, next) {
  const header = req.get('authorization') ?? '';
  const token = header.startsWith('Bearer ') ? header.slice(7).trim() : null;
  if (!token) return res.status(401).json({ error: 'Sign in to continue' });

  let payload;
  try {
    payload = jwt.verify(token, secret, VERIFY_OPTS);
  } catch {
    return res.status(401).json({ error: 'Session expired, sign in again' });
  }

  const id = Number(payload.sub);
  if (!Number.isInteger(id) || id < 1) {
    return res.status(401).json({ error: 'Session expired, sign in again' });
  }

  const row = loadUser(id);
  if (!row) return res.status(401).json({ error: 'Sign in to continue' });

  req.user = {
    sub: id,
    email: row.email,
    name: row.full_name ?? null,
  };
  next();
}

export const authRouter = Router();

const authBurst = rateLimit({
  windowMs: 15 * 60_000,
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many sign-in attempts. Wait a few minutes and try again.' },
});

authRouter.post('/register', authBurst, async (req, res) => {
  const parsed = registerBody.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.issues[0].message });

  const { email, password, fullName } = parsed.data;
  const hash = await bcrypt.hash(password, 10);

  try {
    const info = db
      .prepare('INSERT INTO users (email, password_hash, full_name, created_at) VALUES (?, ?, ?, ?)')
      .run(email, hash, fullName, new Date().toISOString());

    const user = { id: Number(info.lastInsertRowid), email, fullName };
    res.status(201).json({ token: sign(user), user });
  } catch (err) {
    const dup =
      err?.code === 'SQLITE_CONSTRAINT_UNIQUE' ||
      err?.errcode === 2067 ||
      String(err?.message ?? '').includes('UNIQUE constraint');
    if (dup) {
      return res.status(409).json({ error: 'That email is already registered' });
    }
    throw err;
  }
});

authRouter.post('/login', authBurst, async (req, res) => {
  const parsed = credentials.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.issues[0].message });

  const { email, password } = parsed.data;
  const row = db.prepare('SELECT * FROM users WHERE email = ?').get(email);
  const ok = await bcrypt.compare(password, row?.password_hash ?? DUMMY_HASH);
  if (!row || !ok) {
    return res.status(401).json({ error: 'Email or password is incorrect' });
  }

  const user = { id: Number(row.id), email: row.email, fullName: row.full_name ?? null };
  res.json({ token: sign(user), user });
});

authRouter.get('/me', requireAuth, (req, res) => {
  const row = loadUser(req.user.sub);
  if (!row) return res.status(401).json({ error: 'Sign in to continue' });
  res.json({ user: { id: Number(row.id), email: row.email, fullName: row.full_name ?? null } });
});

/** Test helper — wipes the auth database file. */
export function resetAuthDbForTests() {
  db.close();
  try {
    unlinkSync(dbPath);
  } catch {
    /* fresh run */
  }
}
