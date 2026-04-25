// authService.js
// Client-side authentication & user management for InStock.
// Stores users and the active session in localStorage. Passwords are
// salted+hashed with SHA-256 via Web Crypto (browser & jsdom).
//
// NOTE: client-side hashing is appropriate for a prototype / class project.
// Anyone with browser devtools can read localStorage, so don't use this
// pattern for real production secrets.

const USERS_KEY    = 'instock_users_v1';
const SESSION_KEY  = 'instock_session_v1';
const ORGS_KEY     = 'instock_orgs_v1';

// The set of organizations that signups are allowed to link to.
// Per the current spec only "University of Notre Dame" is valid.
const DEFAULT_ORGS = [
  { id: 'org_nd', name: 'University of Notre Dame', shortName: 'Notre Dame' },
];

// Default admin seeded on first run.
const DEFAULT_ADMIN = {
  username: 'admin',
  password: 'admin123',
  role: 'admin',
  orgId: 'org_nd',
};

// ── Storage helpers ─────────────────────────────────────────
function getStorage() {
  if (typeof window !== 'undefined' && window.localStorage) return window.localStorage;
  if (typeof globalThis !== 'undefined' && globalThis.localStorage) return globalThis.localStorage;
  // In-memory fallback (e.g., SSR) — keeps the API working without throwing.
  if (!getStorage._mem) {
    const map = new Map();
    getStorage._mem = {
      getItem: (k) => (map.has(k) ? map.get(k) : null),
      setItem: (k, v) => map.set(k, String(v)),
      removeItem: (k) => map.delete(k),
    };
  }
  return getStorage._mem;
}

function readJSON(key, fallback) {
  try {
    const raw = getStorage().getItem(key);
    if (!raw) return fallback;
    return JSON.parse(raw);
  } catch {
    return fallback;
  }
}

function writeJSON(key, value) {
  getStorage().setItem(key, JSON.stringify(value));
}

// ── Hashing ─────────────────────────────────────────────────
function getCrypto() {
  if (typeof globalThis !== 'undefined' && globalThis.crypto && globalThis.crypto.subtle) {
    return globalThis.crypto;
  }
  if (typeof window !== 'undefined' && window.crypto && window.crypto.subtle) {
    return window.crypto;
  }
  return null;
}

function bytesToHex(buf) {
  const arr = new Uint8Array(buf);
  let out = '';
  for (let i = 0; i < arr.length; i++) {
    out += arr[i].toString(16).padStart(2, '0');
  }
  return out;
}

// Tiny non-cryptographic fallback so unit tests work even if Web Crypto
// isn't present. Real browsers will always use crypto.subtle.
function fallbackHash(input) {
  let h1 = 0xdeadbeef ^ 0;
  let h2 = 0x41c6ce57 ^ 0;
  for (let i = 0; i < input.length; i++) {
    const ch = input.charCodeAt(i);
    h1 = Math.imul(h1 ^ ch, 2654435761);
    h2 = Math.imul(h2 ^ ch, 1597334677);
  }
  h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^ Math.imul(h2 ^ (h2 >>> 13), 3266489909);
  h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^ Math.imul(h1 ^ (h1 >>> 13), 3266489909);
  return (
    (h2 >>> 0).toString(16).padStart(8, '0') +
    (h1 >>> 0).toString(16).padStart(8, '0')
  );
}

export async function hashPassword(password, salt) {
  const c = getCrypto();
  const material = `${salt}::${password}`;
  if (c) {
    const enc = new TextEncoder();
    const buf = await c.subtle.digest('SHA-256', enc.encode(material));
    return bytesToHex(buf);
  }
  return fallbackHash(material);
}

function makeSalt() {
  const c = getCrypto();
  if (c && c.getRandomValues) {
    const arr = new Uint8Array(16);
    c.getRandomValues(arr);
    return bytesToHex(arr.buffer);
  }
  return Math.random().toString(36).slice(2) + Date.now().toString(36);
}

// ── Org helpers ─────────────────────────────────────────────
export function listOrganizations() {
  const orgs = readJSON(ORGS_KEY, null);
  if (!orgs || !Array.isArray(orgs) || orgs.length === 0) {
    writeJSON(ORGS_KEY, DEFAULT_ORGS);
    return DEFAULT_ORGS.slice();
  }
  return orgs;
}

export function findOrganizationByName(name) {
  if (!name || !name.trim()) return null;
  const target = name.trim().toLowerCase();
  return (
    listOrganizations().find(
      (o) =>
        o.name.toLowerCase() === target ||
        (o.shortName && o.shortName.toLowerCase() === target)
    ) || null
  );
}

export function findOrganizationById(id) {
  if (!id) return null;
  return listOrganizations().find((o) => o.id === id) || null;
}

// ── User helpers ────────────────────────────────────────────
function readUsers() {
  return readJSON(USERS_KEY, []);
}

function writeUsers(users) {
  writeJSON(USERS_KEY, users);
}

export function listUsers() {
  // Strip secrets before returning.
  return readUsers().map(({ passwordHash, salt, ...rest }) => rest);
}

export function findUserByUsername(username) {
  if (!username) return null;
  const target = username.trim().toLowerCase();
  return readUsers().find((u) => u.username.toLowerCase() === target) || null;
}

// ── Seed admin / init ───────────────────────────────────────
// Idempotent — safe to call on every app start.
export async function ensureAdminSeeded() {
  listOrganizations(); // ensure orgs exist
  const users = readUsers();
  if (users.some((u) => u.role === 'admin')) return;

  const salt = makeSalt();
  const passwordHash = await hashPassword(DEFAULT_ADMIN.password, salt);
  users.push({
    id: 'user_admin',
    username: DEFAULT_ADMIN.username,
    role: DEFAULT_ADMIN.role,
    orgId: DEFAULT_ADMIN.orgId,
    salt,
    passwordHash,
    createdAt: new Date().toISOString(),
  });
  writeUsers(users);
}

// ── Validation ──────────────────────────────────────────────
export function validateSignup({ username, password, confirmPassword, orgName }) {
  const errors = {};
  if (!username || !username.trim()) errors.username = 'Required';
  else if (username.trim().length < 3) errors.username = 'Must be at least 3 characters';
  else if (!/^[a-zA-Z0-9_.-]+$/.test(username.trim()))
    errors.username = 'Letters, numbers, dot, dash, underscore only';
  else if (findUserByUsername(username)) errors.username = 'Username already taken';

  if (!password) errors.password = 'Required';
  else if (password.length < 6) errors.password = 'Must be at least 6 characters';

  if (confirmPassword !== undefined && password !== confirmPassword) {
    errors.confirmPassword = 'Passwords do not match';
  }

  if (!orgName || !orgName.trim()) {
    errors.orgName = 'Required';
  } else if (!findOrganizationByName(orgName)) {
    errors.orgName = 'Not a valid organization';
  }

  return errors;
}

// ── Public auth API ─────────────────────────────────────────
export async function createAccount({ username, password, orgName, role = 'member' }) {
  const errors = validateSignup({
    username,
    password,
    confirmPassword: password,
    orgName,
  });
  if (Object.keys(errors).length > 0) {
    const err = new Error('Invalid signup');
    err.fieldErrors = errors;
    throw err;
  }

  const org = findOrganizationByName(orgName);
  const salt = makeSalt();
  const passwordHash = await hashPassword(password, salt);
  const user = {
    id: 'user_' + Math.random().toString(36).slice(2, 10),
    username: username.trim(),
    role: role === 'admin' ? 'admin' : 'member',
    orgId: org.id,
    salt,
    passwordHash,
    createdAt: new Date().toISOString(),
  };

  const users = readUsers();
  users.push(user);
  writeUsers(users);

  const { passwordHash: _ph, salt: _s, ...safe } = user;
  return safe;
}

export async function login({ username, password }) {
  if (!username || !password) {
    const err = new Error('Username and password are required');
    err.code = 'MISSING_FIELDS';
    throw err;
  }
  const user = findUserByUsername(username);
  if (!user) {
    const err = new Error('Invalid username or password');
    err.code = 'BAD_CREDENTIALS';
    throw err;
  }
  const candidate = await hashPassword(password, user.salt);
  if (candidate !== user.passwordHash) {
    const err = new Error('Invalid username or password');
    err.code = 'BAD_CREDENTIALS';
    throw err;
  }
  const session = {
    userId: user.id,
    username: user.username,
    role: user.role,
    orgId: user.orgId,
    loggedInAt: new Date().toISOString(),
  };
  writeJSON(SESSION_KEY, session);
  return session;
}

export function getSession() {
  return readJSON(SESSION_KEY, null);
}

export function logout() {
  getStorage().removeItem(SESSION_KEY);
}

// Test/debug helper — wipes everything this module owns.
export function _resetForTests() {
  const s = getStorage();
  s.removeItem(USERS_KEY);
  s.removeItem(SESSION_KEY);
  s.removeItem(ORGS_KEY);
}
