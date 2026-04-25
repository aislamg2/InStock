// Per-organization shared state (equipment, logs, contacts, etc).
// In production: hits /api/state and persists to Postgres.
// In tests: falls back to localStorage so existing UI tests keep working.

const isTest =
  (typeof import.meta !== 'undefined' &&
    import.meta.env &&
    import.meta.env.MODE === 'test') ||
  (typeof process !== 'undefined' &&
    process.env &&
    (process.env.NODE_ENV === 'test' || process.env.VITEST === 'true'));

// The seven keys InStock has historically persisted. We bundle them into
// one JSON blob server-side — but in test mode we read/write the same
// localStorage keys that InStock has always used, so existing tests are
// unaffected.
const KEYS = [
  'instock_items',
  'instock_categories',
  'instock_locations',
  'instock_contacts',
  'instock_manufacturers',
  'instock_status_logs',
  'instock_maintenance_logs',
];

function ls() {
  if (typeof window !== 'undefined' && window.localStorage)
    return window.localStorage;
  if (typeof globalThis !== 'undefined' && globalThis.localStorage)
    return globalThis.localStorage;
  return null;
}

function loadFromLS(key, fallback) {
  try {
    const s = ls();
    if (!s) return fallback;
    const v = s.getItem(key);
    if (!v) return fallback;
    const parsed = JSON.parse(v);
    if (Array.isArray(fallback) && !Array.isArray(parsed)) return fallback;
    return parsed;
  } catch {
    return fallback;
  }
}

// ── Public API ──────────────────────────────────────────────

// Returns the shared state, plus a version token for optimistic concurrency.
// Shape: { state: { instock_items: [...], instock_categories: [...], ... }, version }
export async function loadState() {
  if (isTest) {
    const state = {};
    for (const k of KEYS) state[k] = loadFromLS(k, []);
    return { state, version: 0 };
  }

  const r = await fetch('/api/state', {
    method: 'GET',
    credentials: 'same-origin',
  });
  if (!r.ok) {
    const err = new Error(
      r.status === 401 ? 'Not signed in' : 'Failed to load state'
    );
    err.code = r.status;
    throw err;
  }
  const data = await r.json();
  // Backfill any missing keys so callers can safely destructure.
  const state = data.state || {};
  for (const k of KEYS) if (state[k] === undefined) state[k] = [];
  return { state, version: data.version, updatedAt: data.updatedAt };
}

// Pushes the full state. Returns { ok, version } on success.
// On version conflict the server returns 409 and the up-to-date state.
export async function saveState(state, expectedVersion) {
  if (isTest) {
    const s = ls();
    if (s) {
      for (const k of KEYS) {
        if (state[k] !== undefined) s.setItem(k, JSON.stringify(state[k]));
      }
    }
    return { ok: true, version: (expectedVersion || 0) + 1 };
  }

  const r = await fetch('/api/state', {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'same-origin',
    body: JSON.stringify({ state, version: expectedVersion }),
  });
  if (r.status === 409) {
    const data = await r.json().catch(() => ({}));
    const err = new Error('Version conflict');
    err.code = 409;
    err.current = data.current;
    throw err;
  }
  if (!r.ok) {
    const data = await r.json().catch(() => ({}));
    const err = new Error(data.error || 'Failed to save state');
    err.code = r.status;
    throw err;
  }
  return r.json();
}

// Convenience: build a state object from the current React state slices
// in InStock. Keeps the key wiring in one place.
export function makeStateBlob({
  items,
  categories,
  locations,
  contacts,
  manufacturers,
  statusLogs,
  maintenanceLogs,
}) {
  return {
    instock_items: items,
    instock_categories: categories,
    instock_locations: locations,
    instock_contacts: contacts,
    instock_manufacturers: manufacturers,
    instock_status_logs: statusLogs,
    instock_maintenance_logs: maintenanceLogs,
  };
}

export const STATE_KEYS = KEYS;
