// Client-side auth — calls the /api/auth/* endpoints in production
// and falls back to a localStorage shim when running in the test runner
// (so existing UI tests still work without a real backend).

const isTest =
  (typeof import.meta !== 'undefined' &&
    import.meta.env &&
    import.meta.env.MODE === 'test') ||
  (typeof process !== 'undefined' &&
    process.env &&
    (process.env.NODE_ENV === 'test' || process.env.VITEST === 'true'));

// ── Test-mode shim (mirrors the previous localStorage implementation) ──
// Kept compact so the integration tests that render <InStock /> can still
// register/list equipment without needing a real API.

const TEST_USERS_KEY = 'instock_users_v1';
const TEST_SESSION_KEY = 'instock_session_v1';
const TEST_ORGS_KEY = 'instock_orgs_v1';
const TEST_DEFAULT_ORGS = [
  { id: 'org_nd', name: 'University of Notre Dame', shortName: 'Notre Dame' },
];
const TEST_DEFAULT_ADMIN = {
  username: 'admin',
  password: 'admin123',
  role: 'admin',
  orgId: 'org_nd',
};

function ls() {
  if (typeof window !== 'undefined' && window.localStorage)
    return window.localStorage;
  if (typeof globalThis !== 'undefined' && globalThis.localStorage)
    return globalThis.localStorage;
  if (!ls._mem) {
    const map = new Map();
    ls._mem = {
      getItem: (k) => (map.has(k) ? map.get(k) : null),
      setItem: (k, v) => map.set(k, String(v)),
      removeItem: (k) => map.delete(k),
    };
  }
  return ls._mem;
}
function readJSON(key, fallback) {
  try {
    const raw = ls().getItem(key);
    if (!raw) return fallback;
    return JSON.parse(raw);
  } catch {
    return fallback;
  }
}
function writeJSON(key, value) {
  ls().setItem(key, JSON.stringify(value));
}

function testHash(input) {
  // Tiny non-crypto hash — only used in tests.
  let h1 = 0xdeadbeef ^ 0;
  let h2 = 0x41c6ce57 ^ 0;
  for (let i = 0; i < input.length; i++) {
    const ch = input.charCodeAt(i);
    h1 = Math.imul(h1 ^ ch, 2654435761);
    h2 = Math.imul(h2 ^ ch, 1597334677);
  }
  h1 =
    Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^
    Math.imul(h2 ^ (h2 >>> 13), 3266489909);
  h2 =
    Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^
    Math.imul(h1 ^ (h1 >>> 13), 3266489909);
  return (
    (h2 >>> 0).toString(16).padStart(8, '0') +
    (h1 >>> 0).toString(16).padStart(8, '0')
  );
}

function readUsers() {
  return readJSON(TEST_USERS_KEY, []);
}
function writeUsers(u) {
  writeJSON(TEST_USERS_KEY, u);
}

export function listOrganizations() {
  if (!isTest) {
    // In prod we don't expose this synchronously — call /api/auth/me to get the org.
    return [];
  }
  const orgs = readJSON(TEST_ORGS_KEY, null);
  if (!orgs || !Array.isArray(orgs) || orgs.length === 0) {
    writeJSON(TEST_ORGS_KEY, TEST_DEFAULT_ORGS);
    return TEST_DEFAULT_ORGS.slice();
  }
  return orgs;
}

export function findOrganizationById(id) {
  if (!isTest) return null;
  if (!id) return null;
  return listOrganizations().find((o) => o.id === id) || null;
}

export function findOrganizationByName(name) {
  if (!isTest) return null;
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

export function findUserByUsername(username) {
  if (!isTest) return null;
  if (!username) return null;
  const target = username.trim().toLowerCase();
  return readUsers().find((u) => u.username.toLowerCase() === target) || null;
}

export function listUsers() {
  if (!isTest) return [];
  return readUsers().map(({ passwordHash, salt, ...rest }) => rest);
}

export async function ensureAdminSeeded() {
  if (!isTest) {
    // In prod the server seeds itself — nothing to do client-side.
    return;
  }
  listOrganizations();
  const users = readUsers();
  if (users.some((u) => u.role === 'admin')) return;
  users.push({
    id: 'user_admin',
    username: TEST_DEFAULT_ADMIN.username,
    role: TEST_DEFAULT_ADMIN.role,
    orgId: TEST_DEFAULT_ADMIN.orgId,
    salt: 'testsalt',
    passwordHash: testHash('testsalt::' + TEST_DEFAULT_ADMIN.password),
    createdAt: new Date().toISOString(),
  });
  writeUsers(users);
}

export function validateSignup({ username, password, confirmPassword, orgName }) {
  const errors = {};
  if (!username || !username.trim()) errors.username = 'Required';
  else if (username.trim().length < 3)
    errors.username = 'Must be at least 3 characters';
  else if (!/^[a-zA-Z0-9_.-]+$/.test(username.trim()))
    errors.username = 'Letters, numbers, dot, dash, underscore only';
  else if (isTest && findUserByUsername(username))
    errors.username = 'Username already taken';

  if (!password) errors.password = 'Required';
  else if (password.length < 6)
    errors.password = 'Must be at least 6 characters';

  if (confirmPassword !== undefined && password !== confirmPassword) {
    errors.confirmPassword = 'Passwords do not match';
  }

  if (!orgName || !orgName.trim()) {
    errors.orgName = 'Required';
  } else if (isTest && !findOrganizationByName(orgName)) {
    errors.orgName = 'Not a valid organization';
  }
  return errors;
}

// ── Public API ──────────────────────────────────────────────

export async function login({ username, password }) {
  if (isTest) {
    if (!username || !password) {
      const e = new Error('Username and password are required');
      e.code = 'MISSING_FIELDS';
      throw e;
    }
    const user = findUserByUsername(username);
    if (!user) {
      const e = new Error('Invalid username or password');
      e.code = 'BAD_CREDENTIALS';
      throw e;
    }
    const candidate = testHash(`${user.salt}::${password}`);
    if (candidate !== user.passwordHash) {
      const e = new Error('Invalid username or password');
      e.code = 'BAD_CREDENTIALS';
      throw e;
    }
    const session = {
      userId: user.id,
      username: user.username,
      role: user.role,
      orgId: user.orgId,
      loggedInAt: new Date().toISOString(),
    };
    writeJSON(TEST_SESSION_KEY, session);
    return session;
  }

  const r = await fetch('/api/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'same-origin',
    body: JSON.stringify({ username, password }),
  });
  if (!r.ok) {
    const data = await r.json().catch(() => ({}));
    const err = new Error(data.error || 'Invalid username or password');
    err.code = r.status === 401 ? 'BAD_CREDENTIALS' : 'SERVER_ERROR';
    throw err;
  }
  const data = await r.json();
  return data.user;
}

export async function createAccount({ username, password, orgName, role = 'member' }) {
  if (isTest) {
    const errs = validateSignup({
      username,
      password,
      confirmPassword: password,
      orgName,
    });
    if (Object.keys(errs).length > 0) {
      const err = new Error('Invalid signup');
      err.fieldErrors = errs;
      throw err;
    }
    const org = findOrganizationByName(orgName);
    const salt = 'testsalt';
    const user = {
      id: 'user_' + Math.random().toString(36).slice(2, 10),
      username: username.trim(),
      role: role === 'admin' ? 'admin' : 'member',
      orgId: org.id,
      salt,
      passwordHash: testHash(`${salt}::${password}`),
      createdAt: new Date().toISOString(),
    };
    const users = readUsers();
    users.push(user);
    writeUsers(users);
    const { passwordHash, salt: _s, ...safe } = user;
    return safe;
  }

  const r = await fetch('/api/auth/signup', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'same-origin',
    body: JSON.stringify({ username, password, orgName }),
  });
  if (!r.ok) {
    const data = await r.json().catch(() => ({}));
    const err = new Error(data.error || 'Signup failed');
    if (data.errors) err.fieldErrors = data.errors;
    throw err;
  }
  const data = await r.json();
  return data.user;
}

export async function logout() {
  if (isTest) {
    ls().removeItem(TEST_SESSION_KEY);
    return;
  }
  try {
    await fetch('/api/auth/logout', {
      method: 'POST',
      credentials: 'same-origin',
    });
  } catch {
    // Best-effort — even if the network fails we want the user signed out.
  }
}

// Returns a session ({ user, organization }) or null.
export async function getSession() {
  if (isTest) {
    const s = readJSON(TEST_SESSION_KEY, null);
    if (!s) return null;
    return s; // legacy shape used by tests
  }
  try {
    const r = await fetch('/api/auth/me', {
      method: 'GET',
      credentials: 'same-origin',
    });
    if (!r.ok) return null;
    const data = await r.json();
    if (!data.user) return null;
    return {
      userId: data.user.id,
      username: data.user.username,
      role: data.user.role,
      orgId: data.user.orgId,
      organization: data.organization,
    };
  } catch {
    return null;
  }
}

// Test-only helpers — preserved for the existing test file.
export function _resetForTests() {
  if (!isTest) return;
  const s = ls();
  s.removeItem(TEST_USERS_KEY);
  s.removeItem(TEST_SESSION_KEY);
  s.removeItem(TEST_ORGS_KEY);
}

// Kept for any callers that use it directly (the new login UI calls it
// to ensure orgs/admin exist on first load — in prod this is a no-op
// because the server seeds itself).
export async function hashPassword(password, salt) {
  return testHash(`${salt}::${password}`);
}
