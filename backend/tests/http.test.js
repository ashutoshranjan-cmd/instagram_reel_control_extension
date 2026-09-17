import test from 'node:test';
import assert from 'node:assert/strict';
import express from 'express';
import { execFileSync } from 'node:child_process';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import recognition from '../src/routes/recognition.routes.js';
import media from '../src/routes/media.routes.js';
import { errorHandler } from '../src/middleware/errorHandler.js';
import { musicRecognitionService } from '../src/services/musicRecognition.service.js';

test('HTTP upload contract: validation, recognition response, MP3 bytes and missing-audio errors', async () => {
  const app = express(); app.use('/api', recognition); app.use('/api', media); app.use(errorHandler);
  const server = await new Promise(resolve => { const s = app.listen(0, '127.0.0.1', () => resolve(s)); });
  const endpoint = `http://127.0.0.1:${server.address().port}`;
  const dir = await mkdtemp(path.join(tmpdir(), 'reelsong-http-'));
  try {
    const missing = await fetch(`${endpoint}/api/recognize`, { method: 'POST' });
    assert.equal(missing.status, 400); assert.equal((await missing.json()).code, 'MISSING_AUDIO_FILE');
    const short = new FormData(); short.append('audio', new Blob(['small'], { type: 'audio/webm' }), 'test.webm');
    const tooShort = await fetch(`${endpoint}/api/recognize`, { method: 'POST', body: short });
    assert.equal((await tooShort.json()).code, 'AUDIO_SAMPLE_TOO_SHORT');
    musicRecognitionService.recognizeAudio = async () => ({ success: false, code: 'SONG_NOT_FOUND' });
    const valid = new FormData(); valid.append('audio', new Blob(['a'.repeat(1000)], { type: 'audio/webm' }), 'test.webm');
    const notFound = await fetch(`${endpoint}/api/recognize`, { method: 'POST', body: valid });
    assert.equal(notFound.status, 200); assert.equal((await notFound.json()).code, 'SONG_NOT_FOUND');
    const source = path.join(dir, 'source.mp4');
    execFileSync('ffmpeg', ['-v', 'error', '-f', 'lavfi', '-i', 'color=s=320x240:r=10:d=1', '-f', 'lavfi', '-i', 'sine=duration=1', '-c:v', 'libx264', '-threads', '2', '-c:a', 'aac', '-shortest', source]);
    const conversion = new FormData();
    conversion.append('media', new Blob([await readFile(source)], { type: 'video/mp4' }), 'reel.mp4');
    conversion.append('format', 'mp3'); conversion.append('resolution', 'original');
    const result = await fetch(`${endpoint}/api/media/convert`, { method: 'POST', body: conversion });
    assert.equal(result.status, 200); assert.match(result.headers.get('content-type'), /audio\/mpeg/);
    const bytes = Buffer.from(await result.arrayBuffer()); assert.equal(bytes.subarray(0, 3).toString(), 'ID3');
    const empty = await fetch(`${endpoint}/api/media/convert`, { method: 'POST' });
    assert.equal(empty.status, 400); assert.match((await empty.json()).message, /No video/);
  } finally {
    server.closeAllConnections(); await new Promise(resolve => server.close(resolve));
    await rm(dir, { recursive: true, force: true });
  }
});
