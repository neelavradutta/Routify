import { Router } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import rateLimit from 'express-rate-limit';
import { z } from 'zod';
import { closeStore, findByEmail, findById, initStore, insertUser, resetStoreForTests } from './auth-store.js';

const DEV_SECRET = 'dev-only-secret-change-me';
const secret = process.env.JWT_SECRET || DEV_SECRET;
const TTL = '7d';
const JWT_OPTS = { algorithm: 'HS256', expiresIn: TTL };
const VERIFY_OPTS = { algorithms: ['HS256'] };
const BCRYPT_ROUNDS = 8;

if (process.env.NODE_ENV === 'production') {
  if (!process.env.JWT_SECRET || secret.length < 32 || secret === DEV_SECRET) {
    console.error('Set JWT_SECRET to a random string of at least 32 characters before running in production.');
    process.exit(1);
  }
  if (!process.env.DATABASE_URL) {
    console.warn('WARNING: DATABASE_URL not set — user accounts will be lost when Render restarts.');
  }
}

const DUMMY_HASH = bcrypt.hashSync('invalid-password-timing-pad', BCRYPT_ROUNDS);

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

export async function initAuth() {
  await initStore();
}

export async function requireAuth(req, res, next) {
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

  try {
    const row = await findById(id);
    if (!row) return res.status(401).json({ error: 'Sign in to continue' });

    req.user = {
      sub: id,
      email: row.email,
      name: row.full_name ?? null,
    };
    next();
  } catch (err) {
    next(err);
  }
}

export const authRouter = Router();

const authBurst = rateLimit({
  windowMs: 15 * 60_000,
  max: 30,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many sign-in attempts. Wait a few minutes and try again.' },
});

authRouter.post('/register', authBurst, async (req, res, next) => {
  const parsed = registerBody.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.issues[0].message });

  const { email, password, fullName } = parsed.data;

  try {
    const hash = await bcrypt.hash(password, BCRYPT_ROUNDS);
    const id = await insertUser({
      email,
      password_hash: hash,
      full_name: fullName,
      created_at: new Date().toISOString(),
    });

    const user = { id, email, fullName };
    res.status(201).json({ token: sign(user), user });
  } catch (err) {
    if (String(err?.message ?? '').includes('UNIQUE') || err?.code === '23505') {
      return res.status(409).json({ error: 'That email is already registered' });
    }
    next(err);
  }
});

authRouter.post('/login', authBurst, async (req, res, next) => {
  const parsed = credentials.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.issues[0].message });

  const { email, password } = parsed.data;

  try {
    const row = await findByEmail(email);
    const ok = await bcrypt.compare(password, row?.password_hash ?? DUMMY_HASH);
    if (!row || !ok) {
      return res.status(401).json({ error: 'Email or password is incorrect' });
    }

    const user = { id: Number(row.id), email: row.email, fullName: row.full_name ?? null };
    res.json({ token: sign(user), user });
  } catch (err) {
    next(err);
  }
});

authRouter.get('/me', requireAuth, async (req, res, next) => {
  try {
    const row = await findById(req.user.sub);
    if (!row) return res.status(401).json({ error: 'Sign in to continue' });
    res.json({ user: { id: Number(row.id), email: row.email, fullName: row.full_name ?? null } });
  } catch (err) {
    next(err);
  }
});

export const resetAuthDbForTests = resetStoreForTests;
export const closeAuth = closeStore;
