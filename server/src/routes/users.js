const router   = require('express').Router();
const User     = require('../models/User');
const Painting = require('../models/Painting');
const auth     = require('../middleware/auth');

// GET /api/users/me/favorites  — своё избранное
// ВАЖНО: этот роут должен быть ДО /:id чтобы "me" не трактовался как id
router.get('/me/favorites', auth, async (req, res) => {
  try {
    const user = await User.findById(req.user._id).populate({
      path: 'favorites',
      select: '-svgOutline -svgColored -svgPalette',
      populate: { path: 'author', select: 'username' },
    });
    res.json({ favorites: user.favorites });
  } catch (e) {
    res.status(500).json({ message: e.message });
  }
});

// GET /api/users/:id  — публичный профиль пользователя
router.get('/:id', async (req, res) => {
  try {
    const user = await User.findById(req.params.id).select('-password -favorites');
    if (!user) return res.status(404).json({ message: 'Пользователь не найден' });

    const paintingsCount = await Painting.countDocuments({ author: req.params.id });
    res.json({ user, paintingsCount });
  } catch (e) {
    res.status(500).json({ message: e.message });
  }
});

// GET /api/users/:id/paintings  — публикации пользователя
router.get('/:id/paintings', async (req, res) => {
  try {
    const paintings = await Painting.find({ author: req.params.id })
      .select('-svgOutline -svgColored -svgPalette')
      .populate('author', 'username')
      .sort({ createdAt: -1 });
    res.json({ paintings });
  } catch (e) {
    res.status(500).json({ message: e.message });
  }
});

module.exports = router;
