import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import Layout        from './components/Layout';
import FeedPage      from './pages/FeedPage';
import GeneratorPage from './pages/GeneratorPage';
import PaintingPage  from './pages/PaintingPage';
import FavoritesPage from './pages/FavoritesPage';
import ProfilePage   from './pages/ProfilePage';
import LoginPage     from './pages/LoginPage';
import RegisterPage  from './pages/RegisterPage';

function PrivateRoute({ children }) {
  const { user, loading } = useAuth();
  if (loading) return <div style={{ padding: 40, textAlign: 'center' }}>Загрузка...</div>;
  return user ? children : <Navigate to="/login" replace />;
}

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          <Route element={<Layout />}>
            <Route path="/"              element={<FeedPage />} />
            <Route path="/painting/:id"  element={<PaintingPage />} />
            <Route path="/user/:id"      element={<ProfilePage />} />
            <Route path="/generate"      element={<PrivateRoute><GeneratorPage /></PrivateRoute>} />
            <Route path="/favorites"     element={<PrivateRoute><FavoritesPage /></PrivateRoute>} />
          </Route>
          <Route path="/login"    element={<LoginPage />} />
          <Route path="/register" element={<RegisterPage />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}
