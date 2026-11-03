import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import path from 'path';
import dotenv from 'dotenv';
import apiRouter from './server/routes/api.js';
import { errorHandler } from './server/middleware/errorHandler.js';
import { testConnection } from './server/config/database.js';
import { createServer as createViteServer } from 'vite';

dotenv.config();

async function startServer() {
  const app = express();
  const PORT = Number(process.env.PORT) || 3000;

  // Security & utility middlewares
  app.use(
    helmet({
      contentSecurityPolicy: false,
      crossOriginEmbedderPolicy: false,
    })
  );
  app.use(cors());
  app.use(morgan('dev'));
  app.use(express.json({ limit: '10mb' }));
  app.use(express.urlencoded({ extended: true }));

  // API router (includes GET /api/health)
  app.use('/api', apiRouter);

  // Error handler for API
  app.use('/api', errorHandler);

  // In development, hook Vite's dev server middleware
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.resolve(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  // --- Database Connectivity & Initialization ---
  try {
    await testConnection();
    console.log('[DB] Database operational and verified.');
  } catch (dbErr: any) {
    console.error('[DB] Database initialization error:', dbErr.message);
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`[Server] Cambodian Procurement Management System running on http://localhost:${PORT}`);
  });
}

startServer().catch((err) => {
  console.error('[Server] Fatal startup error:', err);
  process.exit(1);
});
