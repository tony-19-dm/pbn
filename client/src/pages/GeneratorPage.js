import { useState, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { processImage, DIFFICULTY_PRESETS, applyPreprocessing } from '../algorithm';
import { publishPainting } from '../api';
import { useAuth } from '../context/AuthContext';

// ── Slider helper ─────────────────────────────────────────────────────────────
function Slider({ label, value, min, max, step = 1, unit = '', onChange }) {
  return (
    <div className="slider-row">
      <span>{label}: <b>{value}{unit}</b></span>
      <input type="range" min={min} max={max} step={step} value={value}
        onInput={e => onChange(+e.target.value)} />
    </div>
  );
}

// ── StepTitle helper ──────────────────────────────────────────────────────────
function StepTitle({ n, title }) {
  return (
    <div className="step-title">
      <div className="step-num">{n}</div>
      <h3>{title}</h3>
    </div>
  );
}

// ── Progress steps for display ────────────────────────────────────────────────
const STEPS = [
  'K-Means кластеризация...',
  'Построение карты цветов...',
  'Очистка пиксельных полос...',
  'Построение областей...',
  'Удаление мелких областей...',
  'Перестройка областей...',
  'Трассировка контуров...',
  'Сглаживание сегментов...',
  'Генерация SVG...',
];

export default function GeneratorPage() {
  const { user } = useAuth();
  const nav = useNavigate();

  // Step flow
  const [step, setStep]         = useState('upload');
  const [imgSrc, setImgSrc]     = useState(null);
  const [imgEl, setImgEl]       = useState(null);
  const [previewSrc, setPreviewSrc] = useState(null);

  // Preprocessing
  const [pp, setPp] = useState({ brightness: 100, contrast: 100, saturate: 100, hue: 0, blur: 0, grayscale: 0 });
  const Pp = (k, v) => { const next = { ...pp, [k]: v }; setPp(next); updatePreview(imgEl, next); };
  const resetPp = () => { const d = { brightness:100,contrast:100,saturate:100,hue:0,blur:0,grayscale:0 }; setPp(d); updatePreview(imgEl, d); };

  // Settings
  const [mode, setMode]           = useState('simple');
  const [difficulty, setDifficulty] = useState('medium');
  const [settings, setSettings]   = useState({ nColors:16, colorSpace:'RGB', randomSeed:42, minFacetSize:50, showNumbers:true, fontSize:8, customColorsText:'', nHaar:2 });
  const S = (k, v) => setSettings(s => ({ ...s, [k]: v }));

  // Generation
  const [processing, setProcessing] = useState(false);
  const [progressMsg, setProgressMsg] = useState('');
  const [progressIdx, setProgressIdx] = useState(0);
  const [result, setResult]       = useState(null);
  const [tab, setTab]             = useState('outline');

  // Publish
  const [title, setTitle]         = useState('');
  const [publishing, setPublishing] = useState(false);
  const [published, setPublished]   = useState(false);
  const [publishError, setPublishError] = useState('');

  const fileRef = useRef();

  // ── Live preview ─────────────────────────────────────────────────────────────
  const updatePreview = useCallback((img, filters) => {
    if (!img) return;
    const { imgData, w, h } = applyPreprocessing(img, filters);
    const oc = document.createElement('canvas'); oc.width = w; oc.height = h;
    oc.getContext('2d').putImageData(imgData, 0, 0);
    setPreviewSrc(oc.toDataURL());
  }, []);

  const handleFile = useCallback(e => {
    const f = e.target.files[0]; if (!f) return;
    const url = URL.createObjectURL(f);
    setImgSrc(url); setResult(null); setPublished(false); setStep('preprocess');
    const img = new Image();
    img.onload = () => { setImgEl(img); updatePreview(img, pp); };
    img.src = url;
  }, [pp, updatePreview]);

  // ── Generate ──────────────────────────────────────────────────────────────────
  const handleGenerate = useCallback(async () => {
    if (!imgEl) return;
    setProcessing(true); setResult(null); setPublished(false); setProgressIdx(0);

    try {
      const { imgData } = applyPreprocessing(imgEl, pp);
      const parseColors = t => {
        const out = [];
        for (const l of (t || '').split('\n')) {
          const p = l.trim().split(',').map(Number);
          if (p.length === 3 && p.every(v => !isNaN(v) && v >= 0 && v <= 255)) out.push(p);
        }
        return out;
      };

      const cfg = mode === 'simple'
        ? { ...DIFFICULTY_PRESETS[difficulty], colorSpace: 'RGB', randomSeed: 42, showNumbers: true, fontSize: 8, customColorsText: '' }
        : settings;

      const res = await processImage({
        imgData,
        nColors:      cfg.nColors,
        colorSpace:   cfg.colorSpace,
        randomSeed:   cfg.randomSeed,
        minFacetSize: cfg.minFacetSize,
        customColors: parseColors(cfg.customColorsText),
        nHaar:        cfg.nHaar,
        onProgress: (msg) => {
          setProgressMsg(msg);
          setProgressIdx(i => Math.min(i + 1, STEPS.length));
        },
      });

      const args = { ...res, showNumbers: cfg.showNumbers, fontSize: cfg.fontSize };
      const { buildSVG, buildPaletteSVG } = await import('../algorithm');
      const svgOutline = buildSVG({ ...args, showFill: false, showBorders: true });
      const svgColored = buildSVG({ ...args, showFill: true,  showBorders: true });
      const svgPalette = buildPaletteSVG(res.colorsByIndex);

      setResult({ svgOutline, svgColored, svgPalette, colorsByIndex: res.colorsByIndex, cfg });
      setStep('result');
    } catch (e) {
      console.error(e);
      setProgressMsg('Ошибка: ' + e.message);
    } finally {
      setProcessing(false);
    }
  }, [imgEl, pp, mode, difficulty, settings]);

  // ── Publish ───────────────────────────────────────────────────────────────────
  // Генерируем уменьшенный SVG-превью (цветная версия, viewBox сжат до 200x150)
  const makeThumbnail = (svgColored) => {
    try {
      const parser = new DOMParser();
      const doc = parser.parseFromString(svgColored, 'image/svg+xml');
      const svg = doc.documentElement;
      const w = svg.getAttribute('width') || 500;
      const h = svg.getAttribute('height') || 500;
      svg.setAttribute('width',  '200');
      svg.setAttribute('height', '150');
      svg.setAttribute('viewBox', `0 0 ${w} ${h}`);
      svg.setAttribute('preserveAspectRatio', 'xMidYMid meet');
      return new XMLSerializer().serializeToString(svg);
    } catch {
      return '';
    }
  };

  const handlePublish = async (e) => {
    e.preventDefault();
    if (!title.trim()) { setPublishError('Введите название'); return; }
    if (!user) { nav('/login'); return; }
    setPublishing(true); setPublishError('');
    try {
      const cfg = mode === 'simple' ? DIFFICULTY_PRESETS[difficulty] : settings;
      await publishPainting({
        title: title.trim(),
        svgOutline: result.svgOutline,
        svgColored: result.svgColored,
        svgPalette: result.svgPalette,
        thumbnail:  makeThumbnail(result.svgColored),
        nColors:    cfg.nColors,
        difficulty: mode === 'simple' ? difficulty : 'custom',
      });
      setPublished(true);
      setTitle('');
    } catch (err) {
      setPublishError(err.message);
    } finally {
      setPublishing(false);
    }
  };

  // ── Download ──────────────────────────────────────────────────────────────────
  const download = (svg, name) => {
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([svg], { type: 'image/svg+xml' }));
    a.download = name; a.click();
  };

  const tabSvg = result ? { outline: result.svgOutline, colored: result.svgColored, palette: result.svgPalette }[tab] : null;
  const progPct = Math.round((progressIdx / STEPS.length) * 100);

  return (
    <div className="generator">
      <h1 className="page-title">Создать раскраску</h1>

      {/* ── Шаг 1: загрузка ── */}
      <div className="step-card" style={{ opacity: step === 'upload' ? 1 : 0.8 }}>
        <StepTitle n={1} title="Загрузите фото" />
        <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
          <button className="btn-primary" onClick={() => fileRef.current.click()}>
            📁 Выбрать файл
          </button>
          <input ref={fileRef} type="file" accept="image/*" onChange={handleFile} style={{ display: 'none' }} />
          {imgSrc && (
            <span style={{ fontSize: 12, color: '#888', display: 'flex', alignItems: 'center', gap: 8 }}>
              ✅ Загружено
              <button className="btn-ghost" style={{ fontSize: 11 }} onClick={() => fileRef.current.click()}>
                Заменить
              </button>
            </span>
          )}
        </div>
      </div>

      {/* ── Шаг 2: предобработка ── */}
      {step !== 'upload' && (
        <div className="step-card">
          <StepTitle n={2} title="Предобработка изображения" />
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 260px', gap: 20 }}>
            <div style={{ background: '#fafafa', borderRadius: 8, border: '1px solid #eee', display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: 160, overflow: 'hidden' }}>
              <img src={previewSrc || imgSrc} alt="preview" style={{ maxWidth: '100%', maxHeight: 240 }} />
            </div>
            <div>
              <Slider label="Яркость"        value={pp.brightness} min={50}   max={150} unit="%" onChange={v => Pp('brightness', v)} />
              <Slider label="Контрастность"  value={pp.contrast}   min={50}   max={200} unit="%" onChange={v => Pp('contrast', v)} />
              <Slider label="Насыщенность"   value={pp.saturate}   min={0}    max={200} unit="%" onChange={v => Pp('saturate', v)} />
              <Slider label="Оттенок"        value={pp.hue}        min={-180} max={180} unit="°" onChange={v => Pp('hue', v)} />
              <Slider label="Размытие"       value={pp.blur}       min={0}    max={5}   step={0.1} unit="px" onChange={v => Pp('blur', v)} />
              <Slider label="Ч/Б"            value={pp.grayscale}  min={0}    max={100} unit="%" onChange={v => Pp('grayscale', v)} />
              <div style={{ display: 'flex', gap: 8, marginTop: 10 }}>
                <button className="btn-ghost" style={{ fontSize: 12 }} onClick={resetPp}>Сбросить</button>
                <button className="btn-primary" style={{ fontSize: 12 }} onClick={() => setStep('configure')}>
                  Далее →
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── Шаг 3: настройки ── */}
      {(step === 'configure' || step === 'result') && (
        <div className="step-card">
          <StepTitle n={3} title="Настройки" />

          <div className="mode-toggle">
            <button className={mode === 'simple' ? 'active' : ''} onClick={() => setMode('simple')}>Простой</button>
            <button className={mode === 'advanced' ? 'active' : ''} onClick={() => setMode('advanced')}>Расширенный</button>
          </div>

          {mode === 'simple' ? (
            <div className="difficulty-grid">
              {Object.entries(DIFFICULTY_PRESETS).map(([key, p]) => (
                <div key={key} className={`diff-card ${difficulty === key ? 'selected' : ''}`} onClick={() => setDifficulty(key)}>
                  <div className="icon">{p.icon}</div>
                  <div className="label">{p.label}</div>
                  <div className="desc">{p.desc}</div>
                </div>
              ))}
            </div>
          ) : (
            <div>
              <Slider label="Цветов"           value={settings.nColors}      min={2}   max={32}  onChange={v => S('nColors', v)} />
              <Slider label="Мин. область"     value={settings.minFacetSize} min={5}   max={500} step={5} onChange={v => S('minFacetSize', v)} />
              <Slider label="Размер цифр"      value={settings.fontSize}     min={4}   max={20}  onChange={v => S('fontSize', v)} />
              <Slider label="Сглаживание"      value={settings.nHaar}        min={0}   max={4}   onChange={v => S('nHaar', v)} />
              <div style={{ display: 'flex', gap: 12, margin: '10px 0', fontSize: 13 }}>
                {['RGB', 'HSL', 'LAB'].map(cs => (
                  <label key={cs} style={{ display: 'flex', alignItems: 'center', gap: 4, cursor: 'pointer' }}>
                    <input type="radio" name="cs" checked={settings.colorSpace === cs} onChange={() => S('colorSpace', cs)} /> {cs}
                  </label>
                ))}
              </div>
              <label style={{ fontSize: 12, display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer' }}>
                <input type="checkbox" checked={settings.showNumbers} onChange={e => S('showNumbers', e.target.checked)} />
                Показывать номера
              </label>
              <div>
                <label style={{ display: 'block', fontSize: 12, fontWeight: 500, marginBottom: 4, color: '#555' }}>
                  Своя палитра <span style={{ color: '#aaa', fontWeight: 400 }}>(r,g,b — по одному на строку)</span>
                </label>
                <textarea
                  value={settings.customColorsText}
                  onChange={e => S('customColorsText', e.target.value)}
                  placeholder={'255,0,0\n0,128,0\n0,0,255'}
                  rows={4}
                  style={{ width: '100%', padding: '8px 10px', border: '1px solid #ddd', borderRadius: 8, fontSize: 12, fontFamily: 'monospace', resize: 'vertical' }}
                />
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── Кнопка генерации ── */}
      {step !== 'upload' && (
        <button
          className="btn-primary"
          onClick={handleGenerate}
          disabled={processing || step === 'preprocess'}
          style={{ padding: '10px 24px', fontSize: 15, marginBottom: 16, opacity: step === 'preprocess' ? 0.4 : 1 }}
        >
          {processing ? '⏳ Генерация...' : '✨ Сгенерировать раскраску'}
        </button>
      )}

      {/* ── Прогресс ── */}
      {processing && (
        <div className="step-card" style={{ marginBottom: 16 }}>
          <div className="progress-bar"><div className="progress-bar-fill" style={{ width: `${progPct}%` }} /></div>
          <p style={{ fontSize: 13, color: '#888' }}>{progressMsg}</p>
        </div>
      )}

      {/* ── Результат ── */}
      {result && (
        <div className="step-card">
          <StepTitle n={4} title="Результат" />

          <div className="tabs">
            {[['outline','Раскраска'], ['colored','С цветами'], ['palette','Палитра']].map(([key, label]) => (
              <button key={key} className={`tab ${tab === key ? 'active' : ''}`} onClick={() => setTab(key)}>
                {label}
              </button>
            ))}
          </div>

          <div className="svg-preview" style={{ marginBottom: 12 }}>
            <div dangerouslySetInnerHTML={{ __html: tabSvg }} />
          </div>

          {/* Цвета палитры */}
          <div className="palette-row" style={{ marginBottom: 16 }}>
            {result.colorsByIndex.map(([r, g, b], i) => {
              const hex = '#' + [r, g, b].map(v => v.toString(16).padStart(2, '0')).join('').toUpperCase();
              const lum = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
              return (
                <div key={i} className="swatch" title={`${i + 1}: ${hex}`}>
                  <div className="swatch-color" style={{ background: `rgb(${r},${g},${b})`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <span style={{ fontSize: 9, fontWeight: 700, color: lum > 0.45 ? '#222' : '#fff' }}>{i + 1}</span>
                  </div>
                  <span className="swatch-label">{hex}</span>
                </div>
              );
            })}
          </div>

          {/* Скачать */}
          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginBottom: 20 }}>
            <button className="btn-primary" onClick={() => download(result.svgOutline, 'раскраска.svg')}>⬇ Раскраска</button>
            <button className="btn-ghost"   onClick={() => download(result.svgColored,  'цветная.svg')}>⬇ Цветная</button>
            <button className="btn-ghost"   onClick={() => download(result.svgPalette,  'палитра.svg')}>⬇ Палитра</button>
          </div>

          {/* Публикация */}
          <div style={{ borderTop: '1px solid #eee', paddingTop: 16 }}>
            {published ? (
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <span style={{ color: '#16a34a', fontSize: 14 }}>✅ Опубликовано в ленту!</span>
                <button className="btn-ghost" style={{ fontSize: 12 }} onClick={() => nav('/')}>
                  Перейти в ленту →
                </button>
              </div>
            ) : (
              <>
                <p style={{ fontSize: 13, color: '#888', marginBottom: 10 }}>
                  Хотите поделиться раскраской с другими пользователями?
                </p>
                <form className="publish-form" onSubmit={handlePublish}>
                  <input
                    value={title}
                    onChange={e => setTitle(e.target.value)}
                    placeholder="Название раскраски..."
                    maxLength={100}
                  />
                  <button type="submit" className="btn-primary" disabled={publishing}>
                    {publishing ? 'Публикация...' : '🌐 Опубликовать'}
                  </button>
                </form>
                {publishError && <p style={{ color: '#ef4444', fontSize: 13, marginTop: 6 }}>{publishError}</p>}
                {!user && (
                  <p style={{ fontSize: 12, color: '#aaa', marginTop: 6 }}>
                    Нужно <a href="/login" style={{ color: '#4f46e5' }}>войти</a>, чтобы публиковать работы.
                  </p>
                )}
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
