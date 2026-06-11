import { useState, useEffect, useCallback, useRef } from 'react';
import { getFeed, getMyFavorites } from '../api';
import { useAuth } from '../context/AuthContext';
import PaintingCard from '../components/PaintingCard';

export default function FeedPage() {
  const { user } = useAuth();
  const [paintings, setPaintings] = useState([]);
  const [favIds, setFavIds]       = useState(new Set());
  const [search, setSearch]       = useState('');
  const [query, setQuery]         = useState('');   // применённый поиск
  const [page, setPage]           = useState(1);
  const [pages, setPages]         = useState(1);
  const [total, setTotal]         = useState(0);
  const [loading, setLoading]     = useState(false);
  const inputRef = useRef();

  // Загружаем избранное чтобы сразу подсветить сердечки
  useEffect(() => {
    if (!user) return;
    getMyFavorites()
      .then(({ favorites }) => setFavIds(new Set(favorites.map(f => f._id))))
      .catch(() => {});
  }, [user]);

  const loadFeed = useCallback(async (q, p) => {
    setLoading(true);
    try {
      const data = await getFeed(q, p);
      setPaintings(data.paintings);
      setPages(data.pages);
      setTotal(data.total);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadFeed(query, page); }, [query, page, loadFeed]);

  const handleSearch = (e) => {
    e.preventDefault();
    setPage(1);
    setQuery(search);
  };

  const handleFavChange = (id, isFav) => {
    setFavIds(prev => {
      const next = new Set(prev);
      isFav ? next.add(id) : next.delete(id);
      return next;
    });
  };

  return (
    <div>
      <h1 className="page-title">Лента раскрасок</h1>

      <form className="search-bar" onSubmit={handleSearch}>
        <input
          ref={inputRef}
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Поиск по названию..."
        />
        <button type="submit" className="btn-primary">Найти</button>
        {query && (
          <button type="button" className="btn-ghost" onClick={() => { setSearch(''); setQuery(''); setPage(1); }}>
            Сбросить
          </button>
        )}
      </form>

      {query && !loading && (
        <p style={{ fontSize: 13, color: '#888', marginBottom: 16 }}>
          Найдено: {total} {total === 1 ? 'раскраска' : total < 5 ? 'раскраски' : 'раскрасок'}
        </p>
      )}

      {loading ? (
        <p style={{ textAlign: 'center', color: '#aaa', padding: 60 }}>Загрузка...</p>
      ) : paintings.length === 0 ? (
        <div className="empty">
          {query ? 'Ничего не найдено. Попробуйте другой запрос.' : 'Пока нет ни одной раскраски. Будьте первым!'}
        </div>
      ) : (
        <>
          <div className="grid">
            {paintings.map(p => (
              <PaintingCard
                key={p._id}
                painting={p}
                favoritedIds={favIds}
                onFavoriteChange={handleFavChange}
              />
            ))}
          </div>

          {pages > 1 && (
            <div style={{ display: 'flex', justifyContent: 'center', gap: 8, marginTop: 32 }}>
              <button className="btn-ghost" onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1}>
                ← Назад
              </button>
              <span style={{ padding: '6px 14px', fontSize: 13, color: '#888' }}>
                {page} / {pages}
              </span>
              <button className="btn-ghost" onClick={() => setPage(p => Math.min(pages, p + 1))} disabled={page === pages}>
                Вперёд →
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
}
