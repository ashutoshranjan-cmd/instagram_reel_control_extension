import axios from 'axios';
import FormData from 'form-data';
import { normalizeAudDResponse } from '../../utils/normalizer.js';

export class AudDProvider {
  constructor(apiToken) {
    this.apiToken = apiToken;
    this.apiUrl = 'https://api.audd.io/';
  }

  isConfigured() {
    return Boolean(this.apiToken && this.apiToken.trim().length > 0);
  }

  async recognize(audioBuffer, originalFilename = 'sample.webm', mimeType = 'audio/webm') {
    if (!this.isConfigured()) {
      return {
        success: false,
        code: 'PROVIDER_NOT_CONFIGURED',
        message: 'AudD API token is not configured on the backend. Please add AUDD_API_TOKEN in backend/.env'
      };
    }

    const form = new FormData();
    form.append('api_token', this.apiToken);
    form.append('file', audioBuffer, {
      filename: originalFilename,
      contentType: mimeType
    });
    form.append('return', 'apple_music,spotify');

    try {
      const response = await axios.post(this.apiUrl, form, {
        headers: {
          ...form.getHeaders()
        },
        timeout: 15000
      });

      return normalizeAudDResponse(response.data);
    } catch (error) {
      if (error.response?.data?.error) {
        return {
          success: false,
          code: 'PROVIDER_ERROR',
          message: error.response.data.error.error_message || 'AudD recognition failed'
        };
      }
      throw error;
    }
  }
}

