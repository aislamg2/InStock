import { useState, useEffect } from 'react';
import {
  login,
  createAccount,
  listOrganizations,
  ensureAdminSeeded,
} from './authService.js';

const font = "'DM Sans', 'Segoe UI', system-ui, sans-serif";
const accent = '#0f766e';

const ui = {
  page: {
    fontFamily: font,
    background: '#f0fdf4',
    minHeight: '100vh',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 20,
    color: '#1e293b',
  },
  card: {
    background: '#fff',
    borderRadius: 18,
    border: '1px solid #e2e8f0',
    boxShadow: '0 10px 40px rgba(15, 118, 110, 0.08)',
    width: '100%',
    maxWidth: 420,
    padding: 32,
  },
  logo: {
    fontWeight: 800,
    fontSize: 26,
    color: accent,
    letterSpacing: '-0.5px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    marginBottom: 6,
  },
  subtitle: {
    textAlign: 'center',
    color: '#64748b',
    fontSize: 14,
    marginBottom: 22,
  },
  tabs: {
    display: 'flex',
    background: '#f1f5f9',
    borderRadius: 10,
    padding: 4,
    marginBottom: 22,
  },
  tab: (active) => ({
    flex: 1,
    border: 'none',
    background: active ? '#fff' : 'transparent',
    color: active ? accent : '#64748b',
    fontWeight: 700,
    fontSize: 13.5,
    padding: '8px 0',
    borderRadius: 8,
    cursor: 'pointer',
    fontFamily: font,
    boxShadow: active ? '0 1px 3px rgba(0,0,0,0.06)' : 'none',
  }),
  label: {
    display: 'block',
    fontSize: 12,
    fontWeight: 700,
    color: '#475569',
    textTransform: 'uppercase',
    letterSpacing: '.5px',
    marginBottom: 6,
  },
  input: (err) => ({
    border: `1.5px solid ${err ? '#ef4444' : '#d1d5db'}`,
    borderRadius: 10,
    padding: '10px 14px',
    fontSize: 14,
    outline: 'none',
    width: '100%',
    fontFamily: font,
    background: '#fff',
    boxSizing: 'border-box',
  }),
  fieldErr: { color: '#dc2626', fontSize: 12, marginTop: 4, fontWeight: 600 },
  btn: (disabled) => ({
    background: disabled ? '#94a3b8' : accent,
    color: '#fff',
    border: 'none',
    borderRadius: 10,
    padding: '12px 20px',
    fontSize: 14.5,
    fontWeight: 700,
    cursor: disabled ? 'not-allowed' : 'pointer',
    fontFamily: font,
    width: '100%',
    marginTop: 6,
  }),
  alert: {
    background: '#fef2f2',
    border: '1px solid #fecaca',
    color: '#b91c1c',
    borderRadius: 10,
    padding: '10px 12px',
    fontSize: 13,
    fontWeight: 600,
    marginBottom: 14,
  },
  hint: {
    background: '#f0fdf4',
    border: '1px solid #bbf7d0',
    color: '#166534',
    borderRadius: 10,
    padding: '10px 12px',
    fontSize: 12.5,
    marginTop: 18,
    lineHeight: 1.5,
  },
  fieldGroup: { marginBottom: 14 },
};

// Organizations available on the signup form. The server is the source
// of truth for which orgs are valid — this list just populates the
// dropdown. (Future: GET /api/organizations.)
const KNOWN_ORGS = [
  { id: 'org_nd', name: 'University of Notre Dame', shortName: 'Notre Dame' },
];

export default function Login({ onAuthenticated }) {
  const [mode, setMode] = useState('signin'); // 'signin' | 'signup'
  const [orgs, setOrgs] = useState(KNOWN_ORGS);

  // Sign-in state
  const [siUsername, setSiUsername] = useState('');
  const [siPassword, setSiPassword] = useState('');
  const [siError, setSiError] = useState('');
  const [siLoading, setSiLoading] = useState(false);

  // Sign-up state
  const [suUsername, setSuUsername] = useState('');
  const [suPassword, setSuPassword] = useState('');
  const [suConfirm, setSuConfirm] = useState('');
  const [suOrg, setSuOrg] = useState('University of Notre Dame');
  const [suErrors, setSuErrors] = useState({});
  const [suGlobalError, setSuGlobalError] = useState('');
  const [suLoading, setSuLoading] = useState(false);
  const [suSuccess, setSuSuccess] = useState('');

  useEffect(() => {
    let active = true;
    (async () => {
      // No-op in production (server seeds itself); seeds the test-mode
      // localStorage shim during unit/integration tests.
      await ensureAdminSeeded();
      if (!active) return;
      const local = listOrganizations();
      if (local && local.length > 0) setOrgs(local);
    })();
    return () => {
      active = false;
    };
  }, []);

  async function handleSignIn(e) {
    e.preventDefault();
    setSiError('');
    setSiLoading(true);
    try {
      const session = await login({ username: siUsername, password: siPassword });
      onAuthenticated && onAuthenticated(session);
    } catch (err) {
      setSiError(err.message || 'Sign-in failed');
    } finally {
      setSiLoading(false);
    }
  }

  async function handleSignUp(e) {
    e.preventDefault();
    setSuErrors({});
    setSuGlobalError('');
    setSuSuccess('');
    setSuLoading(true);
    try {
      if (suPassword !== suConfirm) {
        setSuErrors({ confirmPassword: 'Passwords do not match' });
        setSuLoading(false);
        return;
      }
      await createAccount({
        username: suUsername,
        password: suPassword,
        orgName: suOrg,
      });
      // Auto sign-in after successful registration.
      const session = await login({ username: suUsername, password: suPassword });
      setSuSuccess('Account created!');
      onAuthenticated && onAuthenticated(session);
    } catch (err) {
      if (err.fieldErrors) setSuErrors(err.fieldErrors);
      else setSuGlobalError(err.message || 'Sign-up failed');
    } finally {
      setSuLoading(false);
    }
  }

  return (
    <div style={ui.page}>
      <link
        href="https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700;800&display=swap"
        rel="stylesheet"
      />
      <div style={ui.card}>
        <div style={ui.logo}>
          <span style={{ fontSize: 28 }}>📦</span> InStock
        </div>
        <div style={ui.subtitle}>Asset tracking, signed in.</div>

        <div style={ui.tabs} role="tablist">
          <button
            type="button"
            role="tab"
            aria-selected={mode === 'signin'}
            style={ui.tab(mode === 'signin')}
            onClick={() => setMode('signin')}
          >
            Sign in
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={mode === 'signup'}
            style={ui.tab(mode === 'signup')}
            onClick={() => setMode('signup')}
          >
            Create account
          </button>
        </div>

        {mode === 'signin' && (
          <form onSubmit={handleSignIn} noValidate>
            {siError && <div role="alert" style={ui.alert}>{siError}</div>}

            <div style={ui.fieldGroup}>
              <label style={ui.label} htmlFor="si-username">Username</label>
              <input
                id="si-username"
                style={ui.input(false)}
                value={siUsername}
                onChange={(e) => setSiUsername(e.target.value)}
                autoComplete="username"
                autoFocus
              />
            </div>

            <div style={ui.fieldGroup}>
              <label style={ui.label} htmlFor="si-password">Password</label>
              <input
                id="si-password"
                type="password"
                style={ui.input(false)}
                value={siPassword}
                onChange={(e) => setSiPassword(e.target.value)}
                autoComplete="current-password"
              />
            </div>

            <button type="submit" style={ui.btn(siLoading)} disabled={siLoading}>
              {siLoading ? 'Signing in…' : 'Sign in'}
            </button>
          </form>
        )}

        {mode === 'signup' && (
          <form onSubmit={handleSignUp} noValidate>
            {suGlobalError && <div role="alert" style={ui.alert}>{suGlobalError}</div>}
            {suSuccess && (
              <div style={{ ...ui.alert, background: '#f0fdf4', borderColor: '#bbf7d0', color: '#166534' }}>
                {suSuccess}
              </div>
            )}

            <div style={ui.fieldGroup}>
              <label style={ui.label} htmlFor="su-username">Username</label>
              <input
                id="su-username"
                style={ui.input(suErrors.username)}
                value={suUsername}
                onChange={(e) => setSuUsername(e.target.value)}
                autoComplete="username"
              />
              {suErrors.username && <div style={ui.fieldErr}>{suErrors.username}</div>}
            </div>

            <div style={ui.fieldGroup}>
              <label style={ui.label} htmlFor="su-password">Password</label>
              <input
                id="su-password"
                type="password"
                style={ui.input(suErrors.password)}
                value={suPassword}
                onChange={(e) => setSuPassword(e.target.value)}
                autoComplete="new-password"
              />
              {suErrors.password && <div style={ui.fieldErr}>{suErrors.password}</div>}
            </div>

            <div style={ui.fieldGroup}>
              <label style={ui.label} htmlFor="su-confirm">Confirm password</label>
              <input
                id="su-confirm"
                type="password"
                style={ui.input(suErrors.confirmPassword)}
                value={suConfirm}
                onChange={(e) => setSuConfirm(e.target.value)}
                autoComplete="new-password"
              />
              {suErrors.confirmPassword && (
                <div style={ui.fieldErr}>{suErrors.confirmPassword}</div>
              )}
            </div>

            <div style={ui.fieldGroup}>
              <label style={ui.label} htmlFor="su-org">Organization</label>
              <select
                id="su-org"
                style={{ ...ui.input(suErrors.orgName), appearance: 'auto' }}
                value={suOrg}
                onChange={(e) => setSuOrg(e.target.value)}
              >
                {orgs.map((o) => (
                  <option key={o.id} value={o.name}>
                    {o.name}
                  </option>
                ))}
              </select>
              {suErrors.orgName && <div style={ui.fieldErr}>{suErrors.orgName}</div>}
              <div style={{ fontSize: 12, color: '#94a3b8', marginTop: 6 }}>
                More organizations coming soon.
              </div>
            </div>

            <button type="submit" style={ui.btn(suLoading)} disabled={suLoading}>
              {suLoading ? 'Creating account…' : 'Create account'}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
