
import esbuild from 'esbuild';
import { spawn, execSync } from 'child_process';
import cpx from 'cpx';
import 'dotenv/config';
import { rm, readFile, writeFile, mkdir } from 'fs/promises';
import fs from 'fs';

const FRONTEND_DEV_PORT = 8000;
const BACKEND_PORT = 3000;

process.env.APP_VERSION = process.env.APP_VERSION || 'dev';

console.log('Starting development environment...');

const apiKey = process.env.API_KEY || process.env.GEMINI_API_KEY;
if (!apiKey) {
  console.error(`
    \x1b[31m[DEV-SERVER ERROR]\x1b[0m API key is missing.
    The backend server requires the Gemini API key to be set.
    Please create a '.env' file in the project root and add: API_KEY="YOUR_GEMINI_API_KEY_HERE"
  `);
  process.exit(1);
}

// Cleanup
await rm('dist', { recursive: true, force: true }).catch(() => {});
await mkdir('dist/styles', { recursive: true });
console.log('Cleaned dist directory.');

// --- Asset Preparation ---

const patchAndCopy = async (src, dest, transform) => {
    try {
        const content = await readFile(src, 'utf-8');
        await writeFile(dest, transform(content));
    } catch (e) {
        console.error(`Failed to patch ${src}:`, e);
    }
};

// 1. Initial Asset Copy (Blocking)
await new Promise(resolve => cpx.copy('src/styles/**', 'dist/styles', resolve));
await new Promise(resolve => cpx.copy('{manifest.json,favicon.svg,_redirects}', 'dist', resolve));

// 2. Initial File Patching
// Fix index.html to point to the bundled JS instead of source TSX
await patchAndCopy('index.html', 'dist/index.html', (html) => html.replace('src="/src/index.tsx"', 'src="/index.js"'));
// Fix sw.js to have a valid cache name
await patchAndCopy('sw.js', 'dist/sw.js', (js) => js.replace('{{VERSION}}', 'dev-' + Date.now()));

// 3. Initial Tailwind Build (Blocking)
// This ensures main.css exists before the browser requests it via SW
console.log('Compiling initial Tailwind CSS...');
try {
    execSync('npx tailwindcss -i ./src/styles/main.css -o ./dist/styles/main.css');
} catch (e) {
    console.error('Tailwind compilation failed:', e.message);
}

console.log('Assets prepared.');

// --- Watchers ---

// Watch Static Assets
cpx.watch('src/styles/**', 'dist/styles');
cpx.watch('{manifest.json,favicon.svg}', 'dist');

// Watch & Patch index.html
fs.watch('index.html', () => {
    patchAndCopy('index.html', 'dist/index.html', (html) => html.replace('src="/src/index.tsx"', 'src="/index.js"'));
});

// Watch & Patch sw.js
fs.watch('sw.js', () => {
    patchAndCopy('sw.js', 'dist/sw.js', (js) => js.replace('{{VERSION}}', 'dev-' + Date.now()));
});

// Watch Tailwind
const tailwindProcess = spawn('npx', ['tailwindcss', '-i', './src/styles/main.css', '-o', './dist/styles/main.css', '--watch'], {
    stdio: 'inherit',
    shell: true
});
tailwindProcess.on('error', (err) => console.error('Tailwind watcher error:', err));


// --- Servers ---

try {
  console.log('Starting backend server...');
  const nodemonProcess = spawn('npx', [
    'nodemon',
    '--watch', 'backend',
    '--ext', 'ts',
    '--exec', 'node --loader ts-node/esm --experimental-specifier-resolution=node backend/server.ts'
  ], {
    stdio: 'inherit',
    shell: true,
    env: { ...process.env, PORT: BACKEND_PORT.toString() }
  });
  nodemonProcess.on('error', (err) => {
    console.error('Failed to start nodemon:', err);
    process.exit(1);
  });
} catch (e) {
  console.error('Backend init failed:', e);
  process.exit(1);
}

try {
  // Determine API Base URL from env or default to provided Render URL if not in dev mode logic
  // For local dev, we usually want localhost, but we allow override via env var.
  const apiBaseUrl = process.env.VITE_API_BASE_URL || process.env.API_BASE_URL || process.env.BACKEND_URL || '';

  const frontendBuilder = await esbuild.context({
    entryPoints: ['src/index.tsx'],
    bundle: true,
    outfile: 'dist/index.js',
    loader: { 
      '.tsx': 'tsx', 
      '.ts': 'ts', 
      '.json': 'json',
      '.woff': 'file',
      '.woff2': 'file',
      '.ttf': 'file',
      '.eot': 'file'
    },
    sourcemap: true,
    define: {
      'import.meta.env.DEV': 'true',
      'import.meta.env.VITE_APP_VERSION': JSON.stringify(process.env.APP_VERSION),
      'import.meta.env.VITE_API_BASE_URL': JSON.stringify(apiBaseUrl),
    },
  });
  await frontendBuilder.watch();
  console.log(`\n🚀 Frontend builder watching...`);
} catch (e) {
  console.error('Frontend build failed:', e);
  process.exit(1);
}
