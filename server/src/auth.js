import { Router } from 'express';
import { DatabaseSync } from 'node:sqlite';
import { mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { z } from 'zod';

const dataDir = join(dirname(fileURLToPath(import.meta.url)), '..', 'data');
mkdirSync(dataDir, { recursive: true });

const db = new DatabaseSync(join(dataDir, 'users.sqlite'));
db.exec(`CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  email TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  created_at TEXT NOT NULL
)`);

const secret = process.env.JWT_SECRET || 'dev-only-secret-change-me';
const TTL = '7d';

const credentials = z.object({
  email: z.string().trim().toLowerCase().email('Enter a valid email address'),
  password: z.string().min(8, 'Password must be at least 8 characters'),
});

const sign = (user) => jwt.sign({ sub: user.id, email: user.email }, secret, { expiresIn: TTL });

export function requireAuth(req, res, next) {
  const header = req.get('authorization') ?? '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : null;
  if (!token) return res.status(401).json({ error: 'Sign in to continue' });
  try {
    req.user = jwt.verify(token, secret);
    next();
  } catch {
    res.status(401).json({ error: 'Session expired, sign in again' });
  }
}

export const authRouter = Router();

authRouter.post('/register', async (req, res) => {
  const parsed = credentials.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.issues[0].message });

  const { email, password } = parsed.data;
  const exists = db.prepare('SELECT id FROM users WHERE email = ?').get(email);
  if (exists) return res.status(409).json({ error: 'That email is already registered' });

  const hash = await bcrypt.hash(password, 10);
  const info = db
    .prepare('INSERT INTO users (email, password_hash, created_at) VALUES (?, ?, ?)')
    .run(email, hash, new Date().toISOString());

  const user = { id: Number(info.lastInsertRowid), email };
  res.status(201).json({ token: sign(user), user });
});

authRouter.post('/login', async (req, res) => {
  const parsed = credentials.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.issues[0].message });

  const { email, password } = parsed.data;
  const row = db.prepare('SELECT * FROM users WHERE email = ?').get(email);
  if (!row || !(await bcrypt.compare(password, row.password_hash))) {
    return res.status(401).json({ error: 'Email or password is incorrect' });
  }

  const user = { id: Number(row.id), email: row.email };
  res.json({ token: sign(user), user });
});

authRouter.get('/me', requireAuth, (req, res) => {
  res.json({ user: { id: req.user.sub, email: req.user.email } });
});
