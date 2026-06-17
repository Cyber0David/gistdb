import { createContext, useContext, useState } from 'react';

const AuthContext = createContext(null);

// Admin: token stored in localStorage (GitHub PAT)
// User: jwt + pat stored in sessionStorage (cleared on tab close)

export function AuthProvider({ children }) {
  const [adminToken, setAdminTokenState] = useState(() => localStorage.getItem('gistdb_token') || '');
  const [userSession, setUserSessionState] = useState(() => {
    try { return JSON.parse(sessionStorage.getItem('gistdb_user') || 'null'); } catch { return null; }
  });

  function setAdminToken(t) {
    if (t) localStorage.setItem('gistdb_token', t);
    else localStorage.removeItem('gistdb_token');
    setAdminTokenState(t);
  }

  function setUserSession(session) {
    // session: { jwt, username, pat, threshold, password }
    // password kept in memory only for encryption — not persisted
    if (session) sessionStorage.setItem('gistdb_user', JSON.stringify({ jwt: session.jwt, username: session.username, threshold: session.threshold }));
    else sessionStorage.removeItem('gistdb_user');
    setUserSessionState(session);
  }

  function logoutUser() { setUserSession(null); }
  function logoutAdmin() { setAdminToken(''); }

  const isAdmin = !!adminToken;
  const isUser  = !!userSession;

  // Active token for GitHub API
  const activeGitHubToken = isAdmin ? adminToken : (isUser ? userSession.pat : '');
  // Encryption password (only for user mode)
  const encryptPassword = isUser ? userSession.password : null;

  return (
    <AuthContext.Provider value={{ adminToken, setAdminToken, isAdmin, logoutAdmin, userSession, setUserSession, isUser, logoutUser, activeGitHubToken, encryptPassword }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() { return useContext(AuthContext); }
