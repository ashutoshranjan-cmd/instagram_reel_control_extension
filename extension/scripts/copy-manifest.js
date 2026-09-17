import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');
const distDir = path.resolve(rootDir, 'dist');

// Ensure dist directory exists
if (!fs.existsSync(distDir)) {
  fs.mkdirSync(distDir, { recursive: true });
}

// Copy manifest.json
const manifestSrc = path.join(rootDir, 'manifest.json');
const manifestDist = path.join(distDir, 'manifest.json');
if (fs.existsSync(manifestSrc)) {
  fs.copyFileSync(manifestSrc, manifestDist);
  console.log('[build] Copied manifest.json to dist/');
}

// Copy icons
const iconsSrc = path.join(rootDir, 'icons');
const iconsDist = path.join(distDir, 'icons');
if (fs.existsSync(iconsSrc)) {
  if (!fs.existsSync(iconsDist)) {
    fs.mkdirSync(iconsDist, { recursive: true });
  }
  const files = fs.readdirSync(iconsSrc);
  for (const file of files) {
    fs.copyFileSync(path.join(iconsSrc, file), path.join(iconsDist, file));
  }
  console.log('[build] Copied icons to dist/icons/');
}

