require('dotenv').config();
const express  = require('express');
const cors     = require('cors');
const mongoose = require('mongoose');

const authRoutes     = require('./routes/auth');
const paintingRoutes = require('./routes/paintings');
const userRoutes     = require('./routes/users');

const app = express();

// ── CORS ──────────────────────────────────────────────────────────────────────
// CLIENT_URL может быть несколько через запятую: "https://a.com,https://b.com"
const allowedOrigins = (process.env.CLIENT_URL || 'http://localhost:3000')
  .split(',')
  .map(s => s.trim());

app.use(cors({
  origin: (origin, cb) => {
    // разрешаем запросы без origin (Postman, мобильные)
    if (!origin || allowedOrigins.includes(origin)) return cb(null, true);
    cb(new Error('Not allowed by CORS'));
  },
  credentials: true,
}));

app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// ── Routes ────────────────────────────────────────────────────────────────────
app.use('/api/auth',      authRoutes);
app.use('/api/paintings', paintingRoutes);
app.use('/api/users',     userRoutes);

app.get('/api/health', (_, res) => res.json({ ok: true, env: process.env.NODE_ENV }));

app.use((_, res) => res.status(404).json({ message: 'Not found' }));
app.use((err, _req, res, _next) => {
  console.error(err.stack);
  res.status(err.status || 500).json({ message: err.message || 'Server error' });
});

// ── DB + Start ────────────────────────────────────────────────────────────────
// Railway даёт MONGODB_URL, локально используем MONGO_URI
const MONGO = process.env.MONGODB_URL
           || process.env.MONGO_URI
           || 'mongodb://localhost:27017/paintbynumbers';

const PORT = process.env.PORT || 5001;

mongoose
  .connect(MONGO)
  .then(() => {
    console.log('MongoDB connected');
    app.listen(PORT, '0.0.0.0', () =>
      console.log(`Server running on port ${PORT}`)
    );
  })
  .catch(err => { console.error('DB connection error:', err); process.exit(1); });
