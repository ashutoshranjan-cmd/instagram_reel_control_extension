import { AudDProvider } from './providers/audd.provider.js';
import { ACRCloudProvider } from './providers/acrcloud.provider.js';

export class MusicRecognitionService {
  constructor() {
    this.providerName = (process.env.MUSIC_PROVIDER || 'audd').toLowerCase();

    this.auddProvider = new AudDProvider(process.env.AUDD_API_TOKEN);
    this.acrcloudProvider = new ACRCloudProvider({
      host: process.env.ACRCLOUD_HOST,
      accessKey: process.env.ACRCLOUD_ACCESS_KEY,
      accessSecret: process.env.ACRCLOUD_ACCESS_SECRET
    });
  }

  getActiveProvider() {
    if (this.providerName === 'acrcloud') {
      return {
        name: 'acrcloud',
        provider: this.acrcloudProvider,
        isConfigured: this.acrcloudProvider.isConfigured()
      };
    }
    return {
      name: 'audd',
      provider: this.auddProvider,
      isConfigured: this.auddProvider.isConfigured()
    };
  }

  async recognizeAudio(audioBuffer, originalFilename, mimeType) {
    const active = this.getActiveProvider();

    if (!active.isConfigured) {
      return {
        success: false,
        code: 'PROVIDER_NOT_CONFIGURED',
        message: `Music recognition provider (${active.name}) is not configured with API keys in backend/.env`,
        provider: active.name
      };
    }

    return await active.provider.recognize(audioBuffer, originalFilename, mimeType);
  }
}

export const musicRecognitionService = new MusicRecognitionService();

