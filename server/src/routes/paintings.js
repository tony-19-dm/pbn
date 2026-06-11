const router   = require('express').Router();
const Painting = require('../models/Painting');
const User     = require('../models/User');
const auth     = require('../middleware/auth');

// GET /api/paintings?search=&page=&limit=
// Лента с поиском по названию
router.get('/', async (req, res) => {
  try {
    const { search = '', page = 1, limit = 20 } = req.query;
    const skip = (parseInt(page) - 1) * parseInt(limit);

    const filter = search.trim()
      ? { $text: { $search: search.trim() } }
      : {};

    const [paintings, total] = await Promise.all([
      Painting.find(filter)
        .select('-svgOutline -svgColored -svgPalette')  // не грузим тяжёлые SVG в ленте, thumbnail остаётся
        .populate('author', 'username')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(parseInt(limit)),
      Painting.countDocuments(filter),
    ]);

    res.json({ paintings, total, page: parseInt(page), pages: Math.ceil(total / parseInt(limit)) });
  } catch (e) {
    res.status(500).json({ message: e.message });
  }
});

// GET /api/paintings/:id  — полные данные с SVG
router.get('/:id', async (req, res) => {
  try {
    const painting = await Painting.findById(req.params.id).populate('author', 'username');
    if (!painting) return res.status(404).json({ message: 'Не найдено' });
    res.json({ painting });
  } catch (e) {
    res.status(500).json({ message: e.message });
  }
});

// POST /api/paintings  — опубликовать раскраску (требует авторизации)
router.post('/', auth, async (req, res) => {
  try {
    const { title, svgOutline, svgColored, svgPalette, thumbnail, nColors, difficulty } = req.body;
    if (!title || !svgOutline || !svgColored || !svgPalette)
      return res.status(400).json({ message: 'Не хватает данных' });

    const painting = await Painting.create({
      title: title.trim(),
      author: req.user._id,
      svgOutline, svgColored, svgPalette,
      thumbnail: thumbnail || '',
      nColors, difficulty,
    });

    res.status(201).json({ painting });
  } catch (e) {
    res.status(500).json({ message: e.message });
  }
});

// DELETE /api/paintings/:id — удалить свою раскраску
router.delete('/:id', auth, async (req, res) => {
  try {
    const painting = await Painting.findById(req.params.id);
    if (!painting) return res.status(404).json({ message: 'Не найдено' });
    if (painting.author.toString() !== req.user._id.toString())
      return res.status(403).json({ message: 'Нет прав' });
    await painting.deleteOne();
    res.json({ message: 'Удалено' });
  } catch (e) {
    res.status(500).json({ message: e.message });
  }
});

// POST /api/paintings/:id/favorite  — добавить/убрать из избранного
router.post('/:id/favorite', auth, async (req, res) => {
  try {
    const painting = await Painting.findById(req.params.id);
    if (!painting) return res.status(404).json({ message: 'Не найдено' });

    const user = await User.findById(req.user._id);
    const idx  = user.favorites.indexOf(painting._id);
    let favorited;

    if (idx === -1) {
      user.favorites.push(painting._id);
      painting.favoritesCount += 1;
      favorited = true;
    } else {
      user.favorites.splice(idx, 1);
      painting.favoritesCount = Math.max(0, painting.favoritesCount - 1);
      favorited = false;
    }

    await Promise.all([user.save(), painting.save()]);
    res.json({ favorited, favoritesCount: painting.favoritesCount });
  } catch (e) {
    res.status(500).json({ message: e.message });
  }
});

module.exports = router;
