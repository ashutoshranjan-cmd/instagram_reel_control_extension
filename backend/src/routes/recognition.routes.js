import { Router } from 'express';
import { uploadAudio } from '../middleware/upload.js';
import { recognitionRateLimiter } from '../middleware/rateLimit.js';
import { recognizeAudioController } from '../controllers/recognition.controller.js';

const router = Router();

// POST /api/recognize with rate limiter and multipart upload
router.post('/recognize', recognitionRateLimiter, uploadAudio, recognizeAudioController);

export default router;

