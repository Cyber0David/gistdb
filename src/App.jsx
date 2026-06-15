import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { AuthProvider } from './hooks/useAuth';
import HomePage from './pages/HomePage';
import DBPage from './pages/DBPage';
import AuthPage from './pages/AuthPage';
import UserSettingsPage from './pages/UserSettingsPage';
import './index.css';

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<HomePage />} />
          <Route path="/db/:id" element={<DBPage />} />
          <Route path="/auth" element={<AuthPage />} />
          <Route path="/settings" element={<UserSettingsPage />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}
