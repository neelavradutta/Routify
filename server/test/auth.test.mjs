import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import express from 'express';

const tmp = mkdtempSync(join(tmpdir(), 'srw-auth-'));
process.env.AUTH_DB_PATH = join(tmp, 'users.sqlite');
process.env.NODE_ENV = 'test';

const { authRouter, requireAuth, resetAuthDbForTests, initAuth } = await import('../src/auth.js');
await initAuth();

const app = express();
app.use(express.json());
app.use('/api/auth', authRouter);
app.get('/api/protected', requireAuth, (_req, res) => res.json({ ok: true }));
app.use((err, _req, res, _next) => {
  console.error(err);
  res.status(500).json({ error: 'Something went wrong on the server' });
});

let base = '';
let server;

before(async () => {
  await new Promise((resolve) => {
    server = app.listen(0, resolve);
  });
  const { port } = server.address();
  base = `http://127.0.0.1:${port}`;
});

after(() => {
  server?.close();
  resetAuthDbForTests();
});

async function post(path, body, token) {
  const headers = { 'Content-Type': 'application/json' };
  if (token) headers.Authorization = `Bearer ${token}`;
  const res = await fetch(`${base}${path}`, { method: 'POST', headers, body: JSON.stringify(body) });
  const data = await res.json().catch(() => ({}));
  return { status: res.status, data };
}

async function get(path, token) {
  const headers = token ? { Authorization: `Bearer ${token}` } : {};
  const res = await fetch(`${base}${path}`, { headers });
  const data = await res.json().catch(() => ({}));
  return { status: res.status, data };
}

test('register + login + me', async () => {
  const reg = await post('/api/auth/register', {
    email: 'walker@example.com',
    password: 'secretpass',
    fullName: 'Alex Walker',
  });
  assert.equal(reg.status, 201);
  assert.ok(reg.data.token);
  assert.equal(reg.data.user.email, 'walker@example.com');
  assert.equal(reg.data.user.fullName, 'Alex Walker');

  const me = await get('/api/auth/me', reg.data.token);
  assert.equal(me.status, 200);
  assert.equal(me.data.user.email, 'walker@example.com');

  const login = await post('/api/auth/login', { email: 'walker@example.com', password: 'secretpass' });
  assert.equal(login.status, 200);
  assert.ok(login.data.token);

  const gate = await get('/api/protected', login.data.token);
  assert.equal(gate.status, 200);
  assert.equal(gate.data.ok, true);
});

test('duplicate register rejected', async () => {
  await post('/api/auth/register', { email: 'dup@example.com', password: 'secretpass', fullName: 'Dup User' });
  const again = await post('/api/auth/register', { email: 'dup@example.com', password: 'secretpass', fullName: 'Dup User' });
  assert.equal(again.status, 409);
});

test('register email case-insensitive', async () => {
  await post('/api/auth/register', { email: 'Case@Example.com', password: 'secretpass', fullName: 'Case User' });
  const dup = await post('/api/auth/register', { email: 'case@example.com', password: 'secretpass', fullName: 'Case User' });
  assert.equal(dup.status, 409);
});

test('login wrong password', async () => {
  await post('/api/auth/register', { email: 'bad@example.com', password: 'secretpass', fullName: 'Bad Login' });
  const res = await post('/api/auth/login', { email: 'bad@example.com', password: 'wrongpass' });
  assert.equal(res.status, 401);
});

test('login unknown email', async () => {
  const res = await post('/api/auth/login', { email: 'ghost@example.com', password: 'secretpass' });
  assert.equal(res.status, 401);
});

test('validation rejects short password and bad email', async () => {
  const short = await post('/api/auth/register', { email: 'a@b.co', password: 'short', fullName: 'A B' });
  assert.equal(short.status, 400);

  const badEmail = await post('/api/auth/register', { email: 'not-an-email', password: 'secretpass', fullName: 'No Email' });
  assert.equal(badEmail.status, 400);

  const longPass = await post('/api/auth/register', {
    email: 'long@example.com',
    password: 'x'.repeat(129),
    fullName: 'Long Pass',
  });
  assert.equal(longPass.status, 400);
});

test('protected routes reject bad tokens', async () => {
  assert.equal((await get('/api/protected')).status, 401);
  assert.equal((await get('/api/protected', 'not-a-jwt')).status, 401);
  assert.equal((await get('/api/protected', 'Bearer ')).status, 401);

  const none = Buffer.from(JSON.stringify({ alg: 'none', typ: 'JWT' })).toString('base64url');
  const payload = Buffer.from(JSON.stringify({ sub: 1, email: 'x@y.com' })).toString('base64url');
  assert.equal((await get('/api/protected', `${none}.${payload}.`)).status, 401);
});
