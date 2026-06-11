import { useState, useEffect } from 'react';
import { getMyFavorites } from '../api';
import PaintingCard from '../components/PaintingCard';

export default function FavoritesPage() {
  const [favorites, setFavorites] = useState([]);
  const [loading, setLoading]     = useState(true);

  const load = () => {
    getMyFavorites()
      .then(({ favorites }) => setFavorites(favorites))
      .catch(console.error)
      .finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, []);

  const handleFavChange = (id, isFav) => {
    if (!isFav) setFavorites(prev => prev.filter(p => p._id !== id));
  };

  const favIds = new Set(favorites.map(f => f._id));

  return (
    <div>
      <h1 className="page-title">Избранное</h1>

      {loading ? (
        <p style={{ textAlign: 'center', color: '#aaa', padding: 60 }}>Загрузка...</p>
      ) : favorites.length === 0 ? (
        <div className="empty">
          У вас пока нет избранных раскрасок.<br />
          Нажмите 🤍 на любой карточке в ленте, чтобы добавить.
        </div>
      ) : (
        <div className="grid">
          {favorites.map(p => (
            <PaintingCard
              key={p._id}
              painting={p}
              favoritedIds={favIds}
              onFavoriteChange={handleFavChange}
            />
          ))}
        </div>
      )}
    </div>
  );
}
