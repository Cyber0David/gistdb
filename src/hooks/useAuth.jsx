import { createContext, useContext, useState } from 'react';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [token, setTokenState] = useState(() => localStorage.getItem('gistdb_token') || '');

  function setToken(t) {
    if (t) localStorage.setItem('gistdb_token', t);
    else localStorage.removeItem('gistdb_token');
    setTokenState(t);
  }

  return (
    <AuthContext.Provider value={{ token, setToken, isAdmin: !!token }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
