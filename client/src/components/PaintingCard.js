import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { toggleFavorite } from '../api';
import { useAuth } from '../context/AuthContext';

// Показываем реальный SVG-превью если есть, иначе заглушка из цветных квадратов
function CardPreview({ painting }) {
  if (painting.thumbnail) {
    return (
      <div
        dangerouslySetInnerHTML={{ __html: painting.thumbnail }}
        style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
      />
    );
  }
  // Fallback для старых карточек без thumbnail
  const colors = {
    easy:   ['#a8d8ea','#aa96da','#fcbad3'],
    medium: ['#a8d8ea','#aa96da','#fcbad3','#ffffd2','#f0e6ff','#c8f0d8'],
    hard:   ['#a8d8ea','#aa96da','#fcbad3','#ffffd2','#f0e6ff','#c8f0d8','#ffd6a5','#ffadad'],
  }[painting.difficulty] || ['#e0e0e0'];
  return (
    <svg viewBox="0 0 120 90" xmlns="http://www.w3.org/2000/svg" style={{ width: '100%', height: '100%' }}>
      {colors.map((c, i) => (
        <rect key={i} x={5+(i%4)*28} y={5+Math.floor(i/4)*28} width={24} height={24} rx={4} fill={c} stroke="#ccc" strokeWidth="0.5"/>
      ))}
      <text x="60" y="80" fontSize="8" textAnchor="middle" fill="#aaa">{painting.nColors} цветов</text>
    </svg>
  );
}

export default function PaintingCard({ painting, favoritedIds = new Set(), onFavoriteChange }) {
  const { user } = useAuth();
  const nav = useNavigate();
  const [favCount, setFavCount]   = useState(painting.favoritesCount || 0);
  const [favorited, setFavorited] = useState(favoritedIds.has(painting._id));
  const [loading, setLoading]     = useState(false);

  const handleFav = async (e) => {
    e.stopPropagation();
    if (!user) { nav('/login'); return; }
    if (loading) return;
    setLoading(true);
    try {
      const res = await toggleFavorite(painting._id);
      setFavorited(res.favorited);
      setFavCount(res.favoritesCount);
      onFavoriteChange && onFavoriteChange(painting._id, res.favorited);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const formatted = new Date(painting.createdAt).toLocaleDateString('ru-RU', { day: 'numeric', month: 'short' });

  return (
    <div className="card" onClick={() => nav(`/painting/${painting._id}`)}>
      <div className="card-preview">
        <CardPreview painting={painting} />
      </div>
      <div className="card-body">
        <div className="card-title" title={painting.title}>{painting.title}</div>
        <Link
          to={`/user/${painting.author?._id}`}
          onClick={e => e.stopPropagation()}
          style={{ fontSize: 11, color: '#aaa', textDecoration: 'none' }}
        >
          @{painting.author?.username}
        </Link>
        <div className="card-meta">
          <span>{formatted}</span>
          <button className="fav-btn" onClick={handleFav} title={favorited ? 'Убрать из избранного' : 'В избранное'}>
            {favorited ? '❤️' : '🤍'} {favCount > 0 && <span style={{ fontSize: 12, color: '#888' }}>{favCount}</span>}
          </button>
        </div>
      </div>
    </div>
  );
}
