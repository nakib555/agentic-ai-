import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import path from 'path';
import fs from 'fs';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import compression from 'compression';
import { fileURLToPath } from 'url';
import { apiHandler } from './handler';
import * as crudHandler from './crudHandler';
import { getSettings, updateSettings } from './settingsHandler';
import { getMemory, updateMemory, clearMemory } from './memoryHandler';
import { getAvailableModelsHandler } from './modelsHandler';
import { initDataStore, HISTORY_PATH } from './data-store';

import { initWebSocket } from './websocketHandler';
import { historyControl } from './services/historyControl';
import { z } from 'zod';

// Validation Schemas
const NewChatSchema = z.object({
  id: z.string().uuid().optional(),
  model: z.string().min(1),
  temperature: z.number().min(0).max(2).optional(),
  maxOutputTokens: z.number().int().positive().optional(),
  imageModel: z.string().optional(),
  videoModel: z.string().optional(),
});

// Determine directory for static files safely across ESM (Dev) and CJS (Prod)
let serverDir: string;
try {
  // In ESM environment (Dev)
  if (import.meta && import.meta.url) {
    const currentFile = fileURLToPath(import.meta.url);
    serverDir = path.join(path.dirname(currentFile), '../dist');
  } else {
    throw new Error('CJS environment detected');
  }
} catch (e) {
  // In CJS bundle environment (Prod), or if import.meta.url is undefined
  // We assume the server is running from project root (via npm start) and static files are in dist/
  serverDir = path.join((process as any).cwd(), 'dist');
}

async function startServer() {
  // --- Initialize Data Store ---
  await initDataStore();
  
  // --- Run Self-Healing ---
  await historyControl.validateAndRepair();

  const app = express();
  const PORT = process.env.PORT || 3001;

  // Security Middlewares
  app.use(helmet({
    contentSecurityPolicy: false, // Disable CSP to allow inline scripts/styles if needed, or configure properly
    crossOriginEmbedderPolicy: false, // Required for FFmpeg.wasm if not using COOP/COEP headers manually
  }) as any);

  const limiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 1000, // Limit each IP to 1000 requests per windowMs
    standardHeaders: true,
    legacyHeaders: false,
    message: { error: 'Too many requests, please try again later.' }
  });
  app.use('/api/', limiter as any);

  // Performance Middleware
  app.use(compression() as any);

  // Middlewares
  const corsOptions = {
    origin: '*', // Allow all origins to support split frontend/backend hosting (e.g. Cloudflare + Render)
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-API-Key', 'X-Client-Version'],
  };

  app.options('*', cors(corsOptions) as any);
  app.use(cors(corsOptions) as any);

  // Security Headers for SharedArrayBuffer (Required for FFmpeg.wasm)
  app.use((req: any, res: any, next: any) => {
    res.setHeader('Cross-Origin-Opener-Policy', 'same-origin');
    res.setHeader('Cross-Origin-Embedder-Policy', 'require-corp');
    next();
  });
  
  // Request Logger Middleware
  app.use(((req: any, res: any, next: any) => {
      const start = Date.now();
      res.on('finish', () => {
          const duration = Date.now() - start;
          console.log(`[SERVER] ${req.method} ${req.url} ${res.statusCode} - ${duration}ms`);
      });
      next();
  }) as any);

  app.use(express.json({ limit: '50mb' }) as any);

  // Version Check Middleware
  const appVersion = process.env.APP_VERSION;
  if (appVersion) {
    app.use('/api', ((req: any, res: any, next: any) => {
      const clientVersion = req.header('X-Client-Version');
      if (clientVersion && clientVersion !== appVersion) {
         // console.warn(`[VERSION_MISMATCH] Client: ${clientVersion}, Server: ${appVersion}.`);
      }
      next();
    }) as any);
    console.log(`[SERVER] Running version: ${appVersion}`);
  }

  // API routes
  app.get('/api/health', ((req: any, res: any) => res.json({ status: 'ok', mode: 'api-only', version: appVersion })) as any);
  
  app.get('/api/models', getAvailableModelsHandler as any);

  app.post('/api/handler', apiHandler as any);
  app.get('/api/handler', apiHandler as any);

  app.get('/api/history', crudHandler.getHistory as any);
  app.delete('/api/history', crudHandler.deleteAllHistory as any);
  app.get('/api/chats/:chatId', crudHandler.getChat as any);
  app.post('/api/chats/new', (req: any, res: any, next: any) => {
    const result = NewChatSchema.safeParse(req.body);
    if (!result.success) {
      return res.status(400).json({ error: 'Invalid request body', details: result.error.format() });
    }
    next();
  }, crudHandler.createNewChat as any);
  app.put('/api/chats/:chatId', crudHandler.updateChat as any);
  app.delete('/api/chats/:chatId', crudHandler.deleteChat as any);
  app.post('/api/import', crudHandler.importChat as any);

  app.get('/api/settings', getSettings as any);
  app.put('/api/settings', updateSettings as any);

  app.get('/api/memory', getMemory as any);
  app.put('/api/memory', updateMemory as any);
  app.delete('/api/memory', clearMemory as any);

  // Mount the HISTORY_PATH to /uploads so that files in data/history/{folder}/file/ are accessible.
  app.use('/uploads', express.static(HISTORY_PATH) as any);

  // Serve static files from the current directory (dist) if they exist
  const indexHtmlPath = path.join(serverDir, 'index.html');
  if (fs.existsSync(indexHtmlPath)) {
      app.use(express.static(serverDir, {
        setHeaders: (res, filePath) => {
           if (filePath.endsWith('index.html') || filePath.endsWith('sw.js')) {
               res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
           }
        }
      }));
      
      // Handle SPA routing: Serve index.html for any unknown non-API routes
      app.get('*', (req, res) => {
        if (req.path.startsWith('/api')) {
          return res.status(404).json({ error: 'API route not found' });
        }
        res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
        res.sendFile(indexHtmlPath);
      });
  } else {
      console.log('[SERVER] Static files not found. Running in API-only mode.');
      app.get('/', (req, res) => {
          const html = `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Agentic AI - Backend Status</title>
    <style>
        :root { --bg: #050505; --card: #121212; --text: #f4f4f5; --subtext: #a1a1aa; --accent: #6366f1; --success: #10b981; }
        body { background: var(--bg); color: var(--text); font-family: system-ui, -apple-system, sans-serif; display: flex; align-items: center; justify-content: center; height: 100vh; margin: 0; }
        .card { background: var(--card); border: 1px solid rgba(255,255,255,0.08); border-radius: 24px; padding: 48px; text-align: center; max-width: 400px; width: 90%; box-shadow: 0 20px 40px rgba(0,0,0,0.4); position: relative; overflow: hidden; }
        .glow { position: absolute; top: -50%; left: -50%; width: 200%; height: 200%; background: radial-gradient(circle, rgba(99,102,241,0.15) 0%, transparent 60%); pointer-events: none; }
        .content { position: relative; z-index: 1; }
        .badge { display: inline-flex; align-items: center; gap: 8px; background: rgba(16,185,129,0.1); color: var(--success); padding: 6px 12px; border-radius: 20px; font-size: 13px; font-weight: 600; margin-bottom: 24px; border: 1px solid rgba(16,185,129,0.2); }
        .dot { width: 8px; height: 8px; background: var(--success); border-radius: 50%; box-shadow: 0 0 0 0 rgba(16,185,129,0.7); animation: pulse 2s infinite; }
        @keyframes pulse { 0% { box-shadow: 0 0 0 0 rgba(16,185,129,0.4); } 70% { box-shadow: 0 0 0 10px rgba(16,185,129,0); } 100% { box-shadow: 0 0 0 0 rgba(16,185,129,0); } }
        h1 { margin: 0 0 12px; font-size: 26px; letter-spacing: -0.02em; font-weight: 700; }
        p { margin: 0 0 32px; color: var(--subtext); line-height: 1.5; font-size: 15px; }
        .logo { color: var(--accent); margin-bottom: 20px; width: 48px; height: 48px; }
        .meta { display: flex; justify-content: center; gap: 24px; border-top: 1px solid rgba(255,255,255,0.08); padding-top: 24px; margin-top: 8px; }
        .meta-item { display: flex; flex-direction: column; gap: 4px; }
        .label { font-size: 11px; text-transform: uppercase; color: var(--subtext); font-weight: 600; letter-spacing: 0.05em; }
        .val { font-family: 'SF Mono', SFMono-Regular, ui-monospace, 'DejaVu Sans Mono', Menlo, Consolas, monospace; font-size: 13px; }
    </style>
</head>
<body>
    <div class="card">
        <div class="glow"></div>
        <div class="content">
            <div class="badge"><div class="dot"></div><span>System Operational</span></div>
            <svg class="logo" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
                <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
                <path d="M12 8v8"/><path d="M8 12h8"/>
            </svg>
            <h1>Agentic AI Backend</h1>
            <p>The neural core is online and ready.<br>Please connect via the frontend application.</p>
            <div class="meta">
                <div class="meta-item"><div class="label">Status</div><div class="val">Online</div></div>
                <div class="meta-item"><div class="label">Port</div><div class="val">${PORT}</div></div>
                <div class="meta-item"><div class="label">Env</div><div class="val">${process.env.NODE_ENV || 'dev'}</div></div>
            </div>
        </div>
    </div>
</body>
</html>`;
          res.send(html);
      });
  }

  // Global Error Handler
  app.use(((err: any, req: any, res: any, next: any) => {
    console.error('[SERVER] Unhandled Error:', err);
    if (!res.headersSent) {
      res.status(500).json({ error: 'Internal Server Error' });
    }
  }) as any);

  const server = app.listen(PORT, () => {
    console.log(`[SERVER] Backend API is running on port ${PORT}`);
    try {
      const wss = initWebSocket();
      
      server.on('upgrade', (request, socket, head) => {
        console.log(`[SERVER] Upgrade request for ${request.url}`);
        
        if (request.url === '/api/ws') {
          wss.handleUpgrade(request, socket, head, (ws) => {
            wss.emit('connection', ws, request);
          });
        } else {
          socket.destroy();
        }
      });
    } catch (err) {
      console.error('[SERVER] Failed to initialize WebSocket server:', err);
    }
  });

  // Graceful Shutdown
  const shutdown = () => {
    console.log('[SERVER] Shutting down gracefully...');
    server.close(() => {
      console.log('[SERVER] Closed out remaining connections.');
      process.exit(0);
    });
    
    // Force shutdown after 10s
    setTimeout(() => {
      console.error('[SERVER] Could not close connections in time, forcefully shutting down');
      process.exit(1);
    }, 10000);
  };

  process.on('SIGTERM', shutdown);
  process.on('SIGINT', shutdown);
}

startServer().catch(err => {
  console.error("Failed to start server:", err);
  (process as any).exit(1);
});