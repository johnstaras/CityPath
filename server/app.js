const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
require('dotenv').config();

const errorHandler = require('./middleware/errorHandler');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(helmet());
app.use(cors());
app.use(express.json());

const authRoutes = require('./routes/authRoutes');
const profileRoutes = require('./routes/profileRoutes');
const mobilityProfileRoutes = require('./routes/mobilityProfileRoutes');
const poiRoutes = require('./routes/poiRoutes');
const routeRoutes = require('./routes/routeRoutes');
const favoriteRoutes = require('./routes/favoriteRoutes');
const sessionRoutes = require('./routes/sessionRoutes');

const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100,
});

app.use('/api/auth', limiter);
app.use('/api/auth', authRoutes);
app.use('/api/profile', profileRoutes);
app.use('/api/mobility-profiles', mobilityProfileRoutes);
app.use('/api/pois', poiRoutes);
app.use('/api/routes', routeRoutes);
app.use('/api/favorites', favoriteRoutes);
app.use('/api/sessions', sessionRoutes);

app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

app.use(errorHandler);

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
