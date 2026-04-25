import { useEffect, useState, useCallback } from 'react';
import InStock from './InStock.jsx';
import Login from './Login.jsx';
import { getSession, logout } from './authService.js';
import { loadState } from './stateService.js';

export default function App() {
  const [session, setSession] = useState(null);
  const [organization, setOrganization] = useState(null);
  const [initialState, setInitialState] = useState(null);
  const [initialVersion, setInitialVersion] = useState(0);
  const [ready, setReady] = useState(false);
  const [loadError, setLoadError] = useState('');

  const hydrate = useCallback(async () => {
    setReady(false);
    setLoadError('');
    try {
      const s = await getSession();
      if (!s) {
        setSession(null);
        setOrganization(null);
        setInitialState(null);
        setReady(true);
        return;
      }
      setSession(s);
      setOrganization(s.organization || null);

      // Pull the org's shared state.
      try {
        const { state, version } = await loadState();
        setInitialState(state);
        setInitialVersion(version || 0);
      } catch (err) {
        // If state load fails we still let the user in — they'll see an empty
        // app and can retry. The most likely cause is a 401 (session expired).
        if (err.code === 401) {
          setSession(null);
          setOrganization(null);
          setInitialState(null);
        } else {
          setLoadError(err.message || 'Failed to load data');
          setInitialState({});
        }
      }
      setReady(true);
    } catch (err) {
      setLoadError(err.message || 'Failed to load');
      setReady(true);
    }
  }, []);

  useEffect(() => {
    hydrate();
  }, [hydrate]);

  if (!ready) {
    return (
      <div
        style={{
          minHeight: '100vh',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontFamily: "'DM Sans', system-ui, sans-serif",
          color: '#64748b',
          background: '#f0fdf4',
        }}
      >
        Loading…
      </div>
    );
  }

  if (!session) {
    return <Login onAuthenticated={() => hydrate()} />;
  }

  return (
    <InStock
      session={session}
      organization={organization}
      initialState={initialState || {}}
      initialVersion={initialVersion}
      loadError={loadError}
      onLogout={async () => {
        await logout();
        setSession(null);
        setOrganization(null);
        setInitialState(null);
        setInitialVersion(0);
      }}
    />
  );
}
