import initSqlJs from 'sql.js';
import pg from 'pg';
import { existsSync, mkdirSync, readFileSync, unlinkSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const { Pool } = pg;

const dataDir = join(dirname(fileURLToPath(import.meta.url)), '..', 'data');
const defaultDbPath = join(dataDir, 'users.sqlite');
const wasmPath = join(
  dirname(fileURLToPath(import.meta.url)),
  '..',
  'node_modules',
  'sql.js',
  'dist',
  'sql-wasm.wasm',
);

/** @type {{ findByEmail: (email: string) => Promise<object|null>, findById: (id: number) => Promise<object|null>, insert: (row: object) => Promise<number>, close: () => Promise<void> }} */
let store = null;
let activePath = defaultDbPath;

const SCHEMA_SQLITE = `CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  email TEXT NOT NULL UNIQUE COLLATE NOCASE,
  password_hash TEXT NOT NULL,
  full_name TEXT,
  created_at TEXT NOT NULL
)`;

async function initPg(url) {
  const pool = new Pool({
    connectionString: url,
    ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
  });

  await pool.query(`CREATE TABLE IF NOT EXISTS users (
    id SERIAL PRIMARY KEY,
    email TEXT NOT NULL UNIQUE,
    password_hash TEXT NOT NULL,
    full_name TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
  )`);

  return {
    async findByEmail(email) {
      const { rows } = await pool.query(
        'SELECT id, email, password_hash, full_name FROM users WHERE LOWER(email) = LOWER($1) LIMIT 1',
        [email],
      );
      return rows[0] ?? null;
    },
    async findById(id) {
      const { rows } = await pool.query(
        'SELECT id, email, full_name FROM users WHERE id = $1 LIMIT 1',
        [id],
      );
      return rows[0] ?? null;
    },
    async insert({ email, password_hash, full_name, created_at }) {
      const { rows } = await pool.query(
        'INSERT INTO users (email, password_hash, full_name, created_at) VALUES ($1, $2, $3, $4) RETURNING id',
        [email, password_hash, full_name, created_at],
      );
      return Number(rows[0].id);
    },
    async close() {
      await pool.end();
    },
  };
}

async function initSqlite(path) {
  mkdirSync(dirname(path), { recursive: true });
  const SQL = await initSqlJs({ locateFile: () => wasmPath });
  const db = existsSync(path) ? new SQL.Database(readFileSync(path)) : new SQL.Database();

  db.run(SCHEMA_SQLITE);
  try {
    db.run('ALTER TABLE users ADD COLUMN full_name TEXT');
  } catch {
    /* exists */
  }

  const persist = () => writeFileSync(path, Buffer.from(db.export()));

  persist();

  return {
    async findByEmail(email) {
      const stmt = db.prepare('SELECT id, email, password_hash, full_name FROM users WHERE email = ? COLLATE NOCASE LIMIT 1');
      stmt.bind([email]);
      if (!stmt.step()) {
        stmt.free();
        return null;
      }
      const row = stmt.getAsObject();
      stmt.free();
      return row;
    },
    async findById(id) {
      const stmt = db.prepare('SELECT id, email, full_name FROM users WHERE id = ? LIMIT 1');
      stmt.bind([id]);
      if (!stmt.step()) {
        stmt.free();
        return null;
      }
      const row = stmt.getAsObject();
      stmt.free();
      return row;
    },
    async insert({ email, password_hash, full_name, created_at }) {
      db.run(
        'INSERT INTO users (email, password_hash, full_name, created_at) VALUES (?, ?, ?, ?)',
        [email, password_hash, full_name, created_at],
      );
      const out = db.exec('SELECT last_insert_rowid() AS id');
      persist();
      return Number(out[0]?.values[0]?.[0] ?? 0);
    },
    async close() {
      db.close();
    },
  };
}

export async function initStore() {
  activePath = process.env.AUTH_DB_PATH || defaultDbPath;

  if (process.env.DATABASE_URL) {
    store = await initPg(process.env.DATABASE_URL);
    console.log('Auth store: PostgreSQL');
    return;
  }

  store = await initSqlite(activePath);
  console.log('Auth store: local SQLite file (dev only — use DATABASE_URL on Render)');
}

export function findByEmail(email) {
  return store.findByEmail(email);
}

export function findById(id) {
  return store.findById(id);
}

export function insertUser(row) {
  return store.insert(row);
}

export async function closeStore() {
  if (store) await store.close();
  store = null;
}

/** Test helper — wipes local sqlite file only. */
export async function resetStoreForTests() {
  await closeStore();
  if (!process.env.DATABASE_URL) {
    try {
      unlinkSync(activePath);
    } catch {
      /* fresh */
    }
  }
  await initStore();
}
