import crypto from 'crypto';
import axios from 'axios';
import FormData from 'form-data';
import { normalizeACRCloudResponse } from '../../utils/normalizer.js';

export class ACRCloudProvider {
  constructor({ host, accessKey, accessSecret }) {
    this.host = host;
    this.accessKey = accessKey;
    this.accessSecret = accessSecret;
  }

  isConfigured() {
    return Boolean(
      this.host &&
      this.accessKey &&
      this.accessSecret &&
      this.host.trim().length > 0
    );
  }

  generateSignature(httpMethod, httpUri, accessKey, accessSecret, dataType, signatureVersion, timestamp) {
    const stringToSign = [
      httpMethod,
      httpUri,
      accessKey,
      dataType,
      signatureVersion,
      timestamp
    ].join('\n');

    return crypto
      .createHmac('sha1', accessSecret)
      .update(Buffer.from(stringToSign, 'utf-8'))
      .digest('base64');
  }

  async recognize(audioBuffer, originalFilename = 'sample.webm') {
    if (!this.isConfigured()) {
      return {
        success: false,
        code: 'PROVIDER_NOT_CONFIGURED',
        message: 'ACRCloud credentials are not configured on the backend. Please add ACRCLOUD_* in backend/.env'
      };
    }

    const currentTimestamp = Math.floor(Date.now() / 1000);
    const httpUri = '/v1/identify';
    const httpMethod = 'POST';
    const signatureVersion = '1';
    const dataType = 'audio';

    const signature = this.generateSignature(
      httpMethod,
      httpUri,
      this.accessKey,
      this.accessSecret,
      dataType,
      signatureVersion,
      currentTimestamp
    );

    const form = new FormData();
    form.append('sample', audioBuffer, {
      filename: originalFilename,
      contentType: 'application/octet-stream'
    });
    form.append('sample_bytes', audioBuffer.length);
    form.append('access_key', this.accessKey);
    form.append('data_type', dataType);
    form.append('signature', signature);
    form.append('signature_version', signatureVersion);
    form.append('timestamp', currentTimestamp);

    const protocol = this.host.startsWith('http') ? '' : 'https://';
    const endpoint = `${protocol}${this.host}${httpUri}`;

    try {
      const response = await axios.post(endpoint, form, {
        headers: {
          ...form.getHeaders()
        },
        timeout: 15000
      });

      return normalizeACRCloudResponse(response.data);
    } catch (error) {
      if (error.response?.data) {
        return {
          success: false,
          code: 'PROVIDER_ERROR',
          message: error.response.data.status?.msg || 'ACRCloud recognition failed'
        };
      }
      throw error;
    }
  }
}

