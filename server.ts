import express, { Request, Response } from 'express';
import { createServer as createViteServer } from 'vite';
import path from 'path';
import { Readable } from 'stream';

const UPSTREAM_TARGET = "https://next-study-pw.ai.studio";
const PORT = Number(process.env.PORT) || 3000;

async function startServer() {
  const app = express();

  // Allow JSON and URL-encoded bodies for API requests
  app.use(express.json());
  app.use(express.urlencoded({ extended: true }));

  // CORS headers
  app.use((req, res, next) => {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS, HEAD');
    res.setHeader('Access-Control-Allow-Headers', '*');
    if (req.method === 'OPTIONS') {
      return res.sendStatus(200);
    }
    next();
  });

  // Dedicated Health check
  app.get('/api/health', (_req: Request, res: Response) => {
    res.json({
      status: 'ok',
      timestamp: Date.now(),
      service: 'nextstudy-mirror',
      version: '1.0.0'
    });
  });

  // API Proxy Handler for all /api/* requests
  app.all('/api/*', async (req: Request, res: Response) => {
    const upstreamUrl = `${UPSTREAM_TARGET}${req.originalUrl}`;
    
    try {
      const headers: Record<string, string> = {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36',
        'Accept': req.headers['accept'] || '*/*',
        'Referer': `${UPSTREAM_TARGET}/`,
        'Origin': UPSTREAM_TARGET,
      };

      if (req.headers['authorization']) {
        headers['Authorization'] = String(req.headers['authorization']);
      }
      if (req.headers['range']) {
        headers['Range'] = String(req.headers['range']);
      }
      if (req.headers['content-type']) {
        headers['Content-Type'] = String(req.headers['content-type']);
      }

      const fetchOptions: RequestInit = {
        method: req.method,
        headers,
      };

      if (['POST', 'PUT', 'PATCH'].includes(req.method) && req.body) {
        fetchOptions.body = typeof req.body === 'string' ? req.body : JSON.stringify(req.body);
      }

      const upstreamRes = await fetch(upstreamUrl, fetchOptions);

      res.status(upstreamRes.status);

      for (const [key, value] of upstreamRes.headers.entries()) {
        const lowerKey = key.toLowerCase();
        if (!['content-encoding', 'transfer-encoding', 'connection'].includes(lowerKey)) {
          res.setHeader(key, value);
        }
      }

      if (upstreamRes.body) {
        Readable.fromWeb(upstreamRes.body as any).pipe(res);
      } else {
        res.end();
      }
    } catch (err: any) {
      console.error(`Proxy failure for ${upstreamUrl}:`, err.message);
      res.status(502).json({
        success: false,
        error: 'Proxy gateway error',
        message: err.message,
      });
    }
  });

  // Penpencil proxy alias
  app.all('/penpencil-proxy*', async (req: Request, res: Response) => {
    const targetPath = req.originalUrl.replace('/penpencil-proxy', '/api/penpencil');
    const upstreamUrl = `${UPSTREAM_TARGET}${targetPath}`;
    try {
      const upstreamRes = await fetch(upstreamUrl, {
        method: req.method,
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)',
          'Referer': `${UPSTREAM_TARGET}/`,
        }
      });
      res.status(upstreamRes.status);
      for (const [key, value] of upstreamRes.headers.entries()) {
        if (!['content-encoding', 'transfer-encoding'].includes(key.toLowerCase())) {
          res.setHeader(key, value);
        }
      }
      if (upstreamRes.body) {
        Readable.fromWeb(upstreamRes.body as any).pipe(res);
      } else {
        res.end();
      }
    } catch (err: any) {
      res.status(502).json({ error: err.message });
    }
  });

  const isProd = process.env.NODE_ENV === 'production';

  if (!isProd) {
    // In dev mode, mount Vite middleware for instant serving & development
    const vite = await createViteServer({
      server: {
        middlewareMode: true,
        host: '0.0.0.0',
        port: PORT,
      },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    // In production, serve the built static dist directory
    const distPath = path.resolve(process.cwd(), 'dist');
    app.use(express.static(distPath, { maxAge: '1h' }));

    // SPA fallback to dist/index.html
    app.get('*', (_req: Request, res: Response) => {
      res.sendFile(path.resolve(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`🚀 Remix PW Ahmad Mirror Server running at http://0.0.0.0:${PORT} (${isProd ? 'production' : 'development'})`);
  });
}

startServer().catch((err) => {
  console.error('Fatal server startup error:', err);
  process.exit(1);
});
