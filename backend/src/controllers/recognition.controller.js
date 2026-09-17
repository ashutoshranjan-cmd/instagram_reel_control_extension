import { musicRecognitionService } from '../services/musicRecognition.service.js';

export async function recognizeAudioController(req, res, next) {
  try {
    if (!req.file || !req.file.buffer) {
      return res.status(400).json({
        success: false,
        code: 'MISSING_AUDIO_FILE',
        message: 'No audio file provided in request. Expected form field "audio".'
      });
    }

    const { buffer, originalname, mimetype } = req.file;

    // Minimum buffer size check (e.g. at least 500 bytes for valid audio header)
    if (buffer.length < 500) {
      return res.status(400).json({
        success: false,
        code: 'AUDIO_SAMPLE_TOO_SHORT',
        message: 'Audio sample is empty or too short for recognition.'
      });
    }

    const result = await musicRecognitionService.recognizeAudio(buffer, originalname, mimetype);

    // If not found or low confidence, return clean 200 with success: false
    return res.status(200).json(result);
  } catch (error) {
    return next(error);
  }
}

