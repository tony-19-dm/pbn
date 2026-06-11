import { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { getPainting, toggleFavorite, deletePainting } from '../api';
import { useAuth } from '../context/AuthContext';

export default function PaintingPage() {
  const { id } = useParams();
  const { user } = useAuth();
  const nav = useNavigate();

  const [painting, setPainting] = useState(null);
  const [loading, setLoading]   = useState(true);
  const [tab, setTab]           = useState('outline');
  const [favorited, setFavorited] = useState(false);
  const [favCount, setFavCount]   = useState(0);
  const [favLoading, setFavLoading] = useState(false);
  const [deleting, setDeleting]     = useState(false);

  useEffect(() => {
    getPainting(id)
      .then(({ painting }) => {
        setPainting(painting);
        setFavCount(painting.favoritesCount || 0);
      })
      .catch(() => nav('/'))
      .finally(() => setLoading(false));
  }, [id, nav]);

  const handleFav = async () => {
    if (!user) { nav('/login'); return; }
    if (favLoading) return;
    setFavLoading(true);
    try {
      const res = await toggleFavorite(id);
      setFavorited(res.favorited);
      setFavCount(res.favoritesCount);
    } catch (e) { console.error(e); }
    finally { setFavLoading(false); }
  };

  const handleDelete = async () => {
    if (!window.confirm('Удалить раскраску?')) return;
    setDeleting(true);
    try {
      await deletePainting(id);
      nav('/');
    } catch (e) {
      alert(e.message);
      setDeleting(false);
    }
  };

  const download = (svgStr, name) => {
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([svgStr], { type: 'image/svg+xml' }));
    a.download = name;
    a.click();
  };

  if (loading) return <p style={{ padding: 40, textAlign: 'center', color: '#aaa' }}>Загрузка...</p>;
  if (!painting) return null;

  const isOwner = user && user._id === painting.author?._id;
  const svgMap  = { outline: painting.svgOutline, colored: painting.svgColored, palette: painting.svgPalette };
  const tabSvg  = svgMap[tab];

  const formatted = new Date(painting.createdAt).toLocaleDateString('ru-RU', {
    day: 'numeric', month: 'long', year: 'numeric'
  });

  return (
    <div className="painting-detail">
      <div className="painting-header">
        <div>
          <h1 style={{ fontSize: 24, fontWeight: 700 }}>{painting.title}</h1>
          <div className="painting-meta">
            <Link to={`/user/${painting.author?._id}`} style={{ color: '#888', textDecoration: 'none' }}>
              @{painting.author?.username}
            </Link>
            {' · '}{formatted}
            {painting.nColors && ` · ${painting.nColors} цветов`}
          </div>
        </div>
        <div className="painting-actions">
          <button
            className="btn-ghost"
            onClick={handleFav}
            disabled={favLoading}
            style={{ fontSize: 18 }}
          >
            {favorited ? '❤️' : '🤍'} {favCount > 0 && favCount}
          </button>
          {isOwner && (
            <button className="btn-danger" onClick={handleDelete} disabled={deleting}>
              {deleting ? 'Удаление...' : 'Удалить'}
            </button>
          )}
        </div>
      </div>

      {/* Вкладки */}
      <div className="tabs">
        {[['outline','Раскраска'], ['colored','С цветами'], ['palette','Палитра']].map(([key, label]) => (
          <button key={key} className={`tab ${tab === key ? 'active' : ''}`} onClick={() => setTab(key)}>
            {label}
          </button>
        ))}
      </div>

      {/* SVG-превью */}
      <div className="svg-preview" style={{ marginBottom: 16 }}>
        {tabSvg
          ? <div dangerouslySetInnerHTML={{ __html: tabSvg }} />
          : <span style={{ color: '#aaa', padding: 40 }}>Нет данных</span>
        }
      </div>

      {/* Скачивание */}
      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
        <button className="btn-primary" onClick={() => download(painting.svgOutline, `${painting.title}-раскраска.svg`)}>
          ⬇ Раскраска (SVG)
        </button>
        <button className="btn-ghost" onClick={() => download(painting.svgColored, `${painting.title}-цветная.svg`)}>
          ⬇ Цветная (SVG)
        </button>
        <button className="btn-ghost" onClick={() => download(painting.svgPalette, `${painting.title}-палитра.svg`)}>
          ⬇ Палитра
        </button>
      </div>
    </div>
  );
}
