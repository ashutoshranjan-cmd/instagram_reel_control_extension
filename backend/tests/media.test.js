import test from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdtemp, readFile, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { convertMedia } from '../src/services/mediaConversion.service.js';

test('FFmpeg: produce real MP3 and portrait/landscape MP4 files, reject invalid input and upscaling', async () => {
  const dir = await mkdtemp(path.join(tmpdir(), 'reelsong-test-'));
  try {
    const source = path.join(dir, 'source.mp4');
    execFileSync('ffmpeg', ['-v', 'error', '-f', 'lavfi', '-i', 'color=c=blue:s=720x1280:r=10:d=1', '-f', 'lavfi', '-i', 'sine=frequency=440:duration=1', '-c:v', 'libx264', '-threads', '2', '-pix_fmt', 'yuv420p', '-c:a', 'aac', '-shortest', source]);
    const input = await readFile(source);
    const mp3 = await convertMedia(input, 'mp3', 'original');
    const mp3path = path.join(dir, 'result.mp3'); await writeFile(mp3path, mp3);
    const audio = JSON.parse(execFileSync('ffprobe', ['-v', 'error', '-show_streams', '-of', 'json', mp3path], { encoding: 'utf8' }));
    assert.equal(audio.streams[0].codec_name, 'mp3');
    assert.ok(Number(audio.streams[0].duration) >= 1);
    const video = await convertMedia(input, 'mp4', '480');
    const videoPath = path.join(dir, 'result.mp4'); await writeFile(videoPath, video);
    const streams = JSON.parse(execFileSync('ffprobe', ['-v', 'error', '-show_streams', '-of', 'json', videoPath], { encoding: 'utf8' })).streams;
    const v = streams.find(s => s.codec_type === 'video');
    assert.equal(v.width, 480); assert.equal(v.height % 2, 0); assert.ok(Math.abs(v.height - 853) <= 1);
    assert.ok(streams.some(s => s.codec_type === 'audio'));
    await assert.rejects(() => convertMedia(input, 'mp4', '1080'), /not smaller/);
    await assert.rejects(() => convertMedia(Buffer.from('bad video'), 'mp3', 'original'), /could not be converted/);
    await assert.rejects(() => convertMedia(input, 'exe', 'original'), /Invalid/);
    const silent = path.join(dir, 'silent.mp4');
    execFileSync('ffmpeg', ['-v', 'error', '-f', 'lavfi', '-i', 'color=s=1280x720:r=10:d=1', '-c:v', 'libx264', '-threads', '2', silent]);
    const noAudio = await readFile(silent);
    await assert.rejects(() => convertMedia(noAudio, 'mp3', 'original'), /no audio track/);
    const landscape = await convertMedia(noAudio, 'mp4', '360');
    const lp = path.join(dir, 'landscape.mp4'); await writeFile(lp, landscape);
    const info = JSON.parse(execFileSync('ffprobe', ['-v', 'error', '-show_streams', '-of', 'json', lp], { encoding: 'utf8' })).streams[0];
    assert.equal(info.width, 640); assert.equal(info.height, 360);
  } finally { await rm(dir, { recursive: true, force: true }); }
});
