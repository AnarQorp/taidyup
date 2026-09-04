import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import { analyzeLocalProject, ProjectAnalysisError } from '../application/analyzeLocalProject.js';

const LOOPBACK_HOSTS = new Set(['127.0.0.1', 'localhost', '[::1]']);

function isLoopbackOrigin(origin: string | undefined): boolean {
  if (!origin) return true;
  try {
    return LOOPBACK_HOSTS.has(new URL(origin).hostname);
  } catch {
    return false;
  }
}

export function createLocalUiApp(options: { distPath?: string } = {}) {
  const app = express();
  const distPath = options.distPath || path.join(process.cwd(), 'dist');

  app.disable('x-powered-by');
  app.use(express.json({ limit: '4kb', strict: true }));

  app.post('/local-api/analyze', async (request, response) => {
    if (!isLoopbackOrigin(request.get('origin'))) {
      return response.status(403).json({ error: { code: 'NON_LOCAL_ORIGIN', message: 'Only the local UI may request analysis.' } });
    }
    if (typeof request.body?.targetPath !== 'string' || request.body.targetPath.trim() === '') {
      return response.status(400).json({ error: { code: 'TARGET_REQUIRED', message: 'Choose an existing local project directory.' } });
    }

    try {
      const result = await analyzeLocalProject(request.body.targetPath.trim());
      response.setHeader('cache-control', 'no-store');
      return response.json(result);
    } catch (error) {
      if (error instanceof ProjectAnalysisError) {
        return response.status(400).json({
          error: { code: error.code, message: error.message, details: error.details }
        });
      }
      console.error('Local analysis failed:', error);
      return response.status(500).json({
        error: { code: 'ANALYSIS_FAILED', message: 'The local analysis could not be completed.' }
      });
    }
  });

  app.use(express.static(distPath));
  app.get('*', (_request, response) => response.sendFile(path.join(distPath, 'index.html')));
  return app;
}

const invokedPath = process.argv[1] ? path.resolve(process.argv[1]) : '';
if (fileURLToPath(import.meta.url) === invokedPath) {
  const port = Number(process.env.TAIDYUP_UI_PORT || 3001);
  createLocalUiApp().listen(port, '127.0.0.1', () => {
    console.log(`tAIdyup local UI: http://127.0.0.1:${port}`);
    console.log('Local-only bridge active. No source code is uploaded.');
  });
}
