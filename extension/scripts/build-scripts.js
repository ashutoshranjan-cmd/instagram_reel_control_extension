import esbuild from 'esbuild';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');
const distDir = path.resolve(rootDir, 'dist');

// Plugin to handle ?raw imports in esbuild
const rawPlugin = {
  name: 'raw-loader',
  setup(build) {
    build.onResolve({ filter: /\?raw$/ }, args => {
      const cleanPath = args.path.replace(/\?raw$/, '');
      const resolved = path.resolve(args.resolveDir, cleanPath);
      return { path: resolved, namespace: 'raw-file' };
    });
    build.onLoad({ filter: /.*/, namespace: 'raw-file' }, async args => {
      const content = await fs.promises.readFile(args.path, 'utf8');
      return { contents: content, loader: 'text' };
    });
  }
};

async function buildAll() {
  console.log('[Build] Building ReelSong Chrome Extension...');

  // Ensure dist directories
  fs.mkdirSync(path.join(distDir, 'content'), { recursive: true });
  fs.mkdirSync(path.join(distDir, 'background'), { recursive: true });

  // 1. Bundle content.js as a self-contained IIFE (no imports, works natively in MV3 content script)
  console.log('[Build] Bundling content.js as standalone IIFE...');
  await esbuild.build({
    entryPoints: [path.join(rootDir, 'src/content/content.jsx')],
    bundle: true,
    format: 'iife',
    platform: 'browser',
    target: ['chrome100'],
    outfile: path.join(distDir, 'content/content.js'),
    define: {
      'process.env.NODE_ENV': '"production"'
    },
    plugins: [rawPlugin],
    minify: false
  });

  // 2. Bundle background/service-worker.js as ES module
  console.log('[Build] Bundling service-worker.js...');
  await esbuild.build({
    entryPoints: [path.join(rootDir, 'src/background/service-worker.js')],
    bundle: true,
    format: 'esm',
    platform: 'browser',
    target: ['chrome100'],
    outfile: path.join(distDir, 'background/service-worker.js'),
    define: {
      'process.env.NODE_ENV': '"production"'
    }
  });

  console.log('[Build] Content script and Service Worker compiled cleanly!');
}

buildAll().catch(err => {
  console.error('[Build Error]:', err);
  process.exit(1);
});

