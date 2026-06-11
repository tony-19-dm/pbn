const mongoose = require('mongoose');

const PaintingSchema = new mongoose.Schema({
  title:       { type: String, required: true, trim: true, maxlength: 100 },
  author:      { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  // SVG-файлы хранятся прямо в БД как строки (до ~1-2 МБ)
  svgOutline:  { type: String, required: true },   // раскраска
  svgColored:  { type: String, required: true },   // с цветами
  svgPalette:  { type: String, required: true },   // палитра
  thumbnail:   { type: String, default: '' },      // маленький SVG для ленты (~20KB)
  // Параметры генерации (для информации)
  nColors:     { type: Number },
  difficulty:  { type: String, enum: ['easy', 'medium', 'hard', 'custom'], default: 'medium' },
  // Счётчики
  favoritesCount: { type: Number, default: 0 },
  createdAt:   { type: Date, default: Date.now },
});

// Текстовый индекс для поиска по названию
PaintingSchema.index({ title: 'text' });
PaintingSchema.index({ createdAt: -1 });

module.exports = mongoose.model('Painting', PaintingSchema);
