import { Router } from 'express';
import multer from 'multer';
import rateLimit from 'express-rate-limit';
import { convertMedia } from '../services/mediaConversion.service.js';
const router = Router();
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 100 * 1024 * 1024, files: 1, fields: 2 } }).single('media');
let busy = false;
router.post('/media/convert', rateLimit({ windowMs: 60000, max: 4 }), (req, res) => {
  if (busy) return res.status(429).json({ message: 'The converter is busy. Please try again shortly.' });
  busy = true;
  upload(req, res, async error => {
    const controller = new AbortController();
    const abort = () => { if (!res.writableEnded) controller.abort(); };
    res.on('close', abort);
    try {
      if (error) return res.status(400).json({ message: error.code === 'LIMIT_FILE_SIZE' ? 'This reel exceeds the 100 MB conversion limit.' : 'Could not read the uploaded video.' });
      if (!req.file?.buffer?.length) return res.status(400).json({ message: 'No video file was supplied.' });
      const { format, resolution } = req.body;
      const buffer = await convertMedia(req.file.buffer, format, resolution, controller.signal);
      res.set({ 'Content-Type': format === 'mp3' ? 'audio/mpeg' : 'video/mp4', 'Content-Disposition': `attachment; filename="reel.${format}"`, 'Cache-Control': 'no-store' });
      res.send(buffer);
    } catch (err) { if (!res.destroyed) res.status(422).json({ message: err.message }); }
    finally { res.removeListener('close', abort); busy = false; }
  });
});
export default router;
