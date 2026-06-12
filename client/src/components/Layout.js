import { Outlet, Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import './Layout.css';

export default function Layout() {
  const { user, signOut } = useAuth();
  const nav = useNavigate();

  const handleSignOut = () => { signOut(); nav('/'); };

  return (
    <div className="layout">
      <header className="header">
        <div className="header-inner">
          <Link to="/" className="logo">🎨 Раскраски По Номерам</Link>
          <nav className="nav">
            <Link to="/">Лента</Link>
            <Link to="/generate">Создать</Link>
            {user && <Link to="/favorites">Избранное</Link>}
          </nav>
          <div className="header-auth">
            {user ? (
              <>
                <Link to={`/user/${user._id}`} style={{ fontSize: 13, color: '#555', textDecoration: 'none', fontWeight: 500 }}>
                  @{user.username}
                </Link>
                <button className="btn-ghost" onClick={handleSignOut}>Выйти</button>
              </>
            ) : (
              <>
                <Link to="/login" className="btn-ghost">Войти</Link>
                <Link to="/register" className="btn-primary">Регистрация</Link>
              </>
            )}
          </div>
        </div>
      </header>
      <main className="main">
        <Outlet />
      </main>
    </div>
  );
}
