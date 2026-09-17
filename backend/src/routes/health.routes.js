import { Router } from 'express';
import { musicRecognitionService } from '../services/musicRecognition.service.js';

const router = Router();

router.get('/health', (req, res) => {
  const active = musicRecognitionService.getActiveProvider();
  res.status(200).json({
    status: 'ok',
    service: 'ReelSong Backend',
    version: '1.0.0',
    uptime: Math.floor(process.uptime()),
    provider: {
      name: active.name,
      configured: active.isConfigured
    },
    timestamp: new Date().toISOString()
  });
});

export default router;

