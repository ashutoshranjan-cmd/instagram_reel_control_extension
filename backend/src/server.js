import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import mediaRoutes from './routes/media.routes.js';
import healthRoutes from './routes/health.routes.js';
import recognitionRoutes from './routes/recognition.routes.js';
import { errorHandler } from './middleware/errorHandler.js';

const app = express();
const PORT = process.env.PORT || 5050;

// Only the extension and local development clients use this local service.
app.use(cors({ origin(origin, callback) {
  if (!origin || /^chrome-extension:\/\/[a-p]{32}$/.test(origin) || /^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(origin)) return callback(null, true);
  callback(new Error('Origin is not allowed.'));
} }));

app.use(express.json({ limit: '2mb' }));
app.use(express.urlencoded({ extended: true, limit: '2mb' }));

// Mount API routes
app.use('/api', healthRoutes);
app.use('/api', mediaRoutes);
app.use('/api', recognitionRoutes);

// Root greeting
app.get('/', (req, res) => {
  res.json({
    name: 'ReelSong Audio Recognition Server',
    status: 'running',
    healthCheck: '/api/health'
  });
});

// Centralized error handler
app.use(errorHandler);

app.listen(PORT, process.env.HOST || '127.0.0.1', () => {
  console.log(`[ReelSong Backend] Server listening on port ${PORT}`);
  console.log(`[ReelSong Backend] Health check: http://localhost:${PORT}/api/health`);
  console.log(`[ReelSong Backend] Provider: ${process.env.MUSIC_PROVIDER || 'audd'}`);
});

