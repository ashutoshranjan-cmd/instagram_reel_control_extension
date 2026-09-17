import { spawn } from 'node:child_process';
import { mkdtemp, writeFile, readFile, rm, stat } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';

function run(command, args, signal) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, { stdio: ['ignore', 'pipe', 'pipe'], signal });
    let output = '', errors = '';
    const timer = setTimeout(() => child.kill('SIGKILL'), 120000);
    child.stdout.on('data', data => { output = (output + data.toString()).slice(-1000000); });
    child.stderr.on('data', data => { errors = (errors + data.toString()).slice(-8000); });
    child.on('error', error => { clearTimeout(timer); reject(new Error(error.code === 'ENOENT' ? 'Install FFmpeg and ffprobe on the conversion server.' : 'Conversion was interrupted.')); });
    child.on('close', code => { clearTimeout(timer); code === 0 ? resolve(output) : reject(new Error(errors.includes('matches no streams') ? 'This reel has no audio track to extract.' : 'This source could not be converted. Try downloading the original video.')); });
  });
}
export async function convertMedia(buffer, format, resolution, signal) {
  if (!['mp3', 'mp4'].includes(format) || !['original', '1080', '720', '480', '360'].includes(String(resolution))) throw new Error('Invalid output format or resolution.');
  const dir = await mkdtemp(path.join(tmpdir(), 'reelsong-'));
  try {
    const input = path.join(dir, 'input.mp4');
    const output = path.join(dir, `output.${format}`);
    await writeFile(input, buffer);
    const probe = JSON.parse(await run('ffprobe', ['-v', 'error', '-protocol_whitelist', 'file,pipe', '-format_whitelist', 'mov,matroska,webm', '-show_streams', '-show_format', '-of', 'json', input], signal));
    const video = probe.streams?.find(s => s.codec_type === 'video');
    if (!video) throw new Error('No video track found in this reel.');
    const duration = Number(probe.format?.duration || video.duration);
    if (!Number.isFinite(duration) || duration <= 0 || duration > 1200) throw new Error('Only reels up to 20 minutes can be converted.');
    if (video.width * video.height > 3840 * 2160) throw new Error('This video exceeds the conversion size limit.');
    const args = ['-hide_banner', '-loglevel', 'error', '-nostdin', '-y', '-protocol_whitelist', 'file,pipe', '-format_whitelist', 'mov,matroska,webm', '-i', input];
    if (format === 'mp3') {
      if (!probe.streams.some(s => s.codec_type === 'audio')) throw new Error('This reel has no audio track to extract.');
      args.push('-map', '0:a:0', '-vn', '-c:a', 'libmp3lame', '-b:a', '192k');
    } else {
      args.push('-map', '0:v:0', '-map', '0:a:0?');
      if (resolution === 'original') args.push('-c', 'copy');
      else {
        const target = Number(resolution);
        if (target >= Math.min(video.width, video.height)) throw new Error('Requested resolution is not smaller than the source. Select Original instead.');
        const scale = video.width <= video.height ? `${target}:-2` : `-2:${target}`;
        args.push('-vf', `scale=${scale}`, '-c:v', 'libx264', '-preset', 'veryfast', '-crf', '22', '-pix_fmt', 'yuv420p', '-c:a', 'aac', '-b:a', '160k');
      }
      args.push('-movflags', '+faststart');
    }
    args.push('-threads', '2', '-fs', String(150 * 1024 * 1024), output);
    await run('ffmpeg', args, signal);
    if ((await stat(output)).size >= 150 * 1024 * 1024) throw new Error('Converted file exceeds the download limit. Choose a smaller resolution.');
    return await readFile(output);
  } finally { await rm(dir, { recursive: true, force: true }); }
}
