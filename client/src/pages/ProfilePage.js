import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { getUserProfile, getUserPaintings } from '../api';
import { useAuth } from '../context/AuthContext';
import PaintingCard from '../components/PaintingCard';

export default function ProfilePage() {
  const { id } = useParams();
  const { user: me } = useAuth();
  const nav = useNavigate();

  const [profile, setProfile]     = useState(null);
  const [paintings, setPaintings] = useState([]);
  const [loading, setLoading]     = useState(true);
  const [error, setError]         = useState('');

  useEffect(() => {
    setLoading(true);
    Promise.all([getUserProfile(id), getUserPaintings(id)])
      .then(([profileData, paintingsData]) => {
        setProfile(profileData);
        setPaintings(paintingsData.paintings);
      })
      .catch(e => setError(e.message))
      .finally(() => setLoading(false));
  }, [id]);

  if (loading) return <p style={{ padding: 40, textAlign: 'center', color: '#aaa' }}>Загрузка...</p>;
  if (error)   return <p style={{ padding: 40, textAlign: 'center', color: '#ef4444' }}>{error}</p>;
  if (!profile) return null;

  const { user, paintingsCount } = profile;
  const isMe = me && me._id === user._id;
  const joined = new Date(user.createdAt).toLocaleDateString('ru-RU', { month: 'long', year: 'numeric' });

  return (
    <div>
      {/* Шапка профиля */}
      <div style={{ background: '#fff', border: '1px solid #e8e8e8', borderRadius: 16, padding: '28px 32px', marginBottom: 28, display: 'flex', alignItems: 'center', gap: 24 }}>
        {/* Аватар-заглушка */}
        <div style={{ width: 72, height: 72, borderRadius: '50%', background: '#4f46e5', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
          <span style={{ color: '#fff', fontSize: 28, fontWeight: 700 }}>
            {user.username[0].toUpperCase()}
          </span>
        </div>

        <div style={{ flex: 1 }}>
          <h1 style={{ fontSize: 22, fontWeight: 700, marginBottom: 4 }}>@{user.username}</h1>
          <p style={{ fontSize: 13, color: '#888' }}>На сервисе с {joined}</p>
          <div style={{ display: 'flex', gap: 20, marginTop: 10 }}>
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontSize: 18, fontWeight: 700 }}>{paintingsCount}</div>
              <div style={{ fontSize: 12, color: '#888' }}>раскрасок</div>
            </div>
          </div>
        </div>

        {isMe && (
          <div style={{ display: 'flex', gap: 8 }}>
            <button className="btn-primary" onClick={() => nav('/generate')}>
              + Создать
            </button>
            <button className="btn-ghost" onClick={() => nav('/favorites')}>
              Избранное
            </button>
          </div>
        )}
      </div>

      {/* Работы пользователя */}
      <h2 style={{ fontSize: 16, fontWeight: 600, marginBottom: 16 }}>
        {isMe ? 'Мои раскраски' : `Раскраски @${user.username}`}
      </h2>

      {paintings.length === 0 ? (
        <div className="empty">
          {isMe
            ? 'У вас пока нет опубликованных раскрасок. Создайте первую!'
            : 'Этот пользователь ещё ничего не опубликовал.'}
        </div>
      ) : (
        <div className="grid">
          {paintings.map(p => (
            <PaintingCard key={p._id} painting={p} />
          ))}
        </div>
      )}
    </div>
  );
}
