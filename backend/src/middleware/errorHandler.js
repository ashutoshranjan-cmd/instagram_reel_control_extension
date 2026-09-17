export function errorHandler(err, req, res, next) {
  // Never log sensitive data or full body
  const isDev = process.env.NODE_ENV !== 'production';

  if (isDev) {
    console.error('[ReelSong Backend Error]:', err.message);
  }

  // Multer-specific errors
  if (err.name === 'MulterError') {
    if (err.code === 'LIMIT_FILE_SIZE') {
      return res.status(413).json({
        success: false,
        code: 'AUDIO_FILE_TOO_LARGE',
        message: 'Audio sample exceeds the 15MB limit'
      });
    }
    return res.status(400).json({
      success: false,
      code: 'UPLOAD_ERROR',
      message: err.message
    });
  }

  // Unsupported MIME type or custom validation error
  if (err.message && err.message.includes('MIME type')) {
    return res.status(400).json({
      success: false,
      code: 'INVALID_MIME_TYPE',
      message: err.message
    });
  }

  // Timeout error
  if (err.code === 'ECONNABORTED' || err.message?.includes('timeout')) {
    return res.status(504).json({
      success: false,
      code: 'PROVIDER_TIMEOUT',
      message: 'Music recognition request timed out'
    });
  }

  // Default internal server error
  return res.status(500).json({
    success: false,
    code: 'INTERNAL_SERVER_ERROR',
    message: isDev ? err.message : 'An error occurred while processing the audio'
  });
}

