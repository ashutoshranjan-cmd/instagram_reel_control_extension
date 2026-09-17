import multer from 'multer';

// Use memory storage so audio buffers are processed in memory and never persisted
const storage = multer.memoryStorage();

const allowedMimeTypes = [
  'audio/webm',
  'audio/ogg',
  'audio/wav',
  'audio/x-wav',
  'audio/mpeg',
  'audio/mp3',
  'audio/mp4',
  'audio/aac',
  'application/octet-stream'
];

export const uploadAudio = multer({
  storage,
  limits: {
    fileSize: 15 * 1024 * 1024 // 15 MB max
  },
  fileFilter: (req, file, cb) => {
    if (allowedMimeTypes.includes(file.mimetype) || file.mimetype.startsWith('audio/')) {
      cb(null, true);
    } else {
      cb(new Error(`Unsupported audio MIME type: ${file.mimetype}`));
    }
  }
}).single('audio');

