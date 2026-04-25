import { useEffect, useState } from 'react';
import InStock from './InStock.jsx';
import Login from './Login.jsx';
import {
  getSession,
  logout,
  ensureAdminSeeded,
  findOrganizationById,
} from './authService.js';

export default function App() {
  const [session, setSession] = useState(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let active = true;
    (async () => {
      // Seed default admin & orgs on first load.
      await ensureAdminSeeded();
      if (!active) return;
      setSession(getSession());
      setReady(true);
    })();
    return () => {
      active = false;
    };
  }, []);

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
    return <Login onAuthenticated={(s) => setSession(s)} />;
  }

  const org = findOrganizationById(session.orgId);
  return (
    <InStock
      session={session}
      organization={org}
      onLogout={() => {
        logout();
        setSession(null);
      }}
    />
  );
}
