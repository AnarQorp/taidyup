import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import { analyzeLocalProject, ProjectAnalysisError } from '../application/analyzeLocalProject.js';
import { analyzeConnectedLocalProject } from '../application/analyzeConnectedLocalProject.js';
import { ConnectedTransportError } from '../connected/n8n/n8nConnectedClient.js';
import { RuntimeArtifactError } from '../runtime/runtimeEvidence.js';
import { analyzeBundledDemo } from '../application/analyzeBundledDemo.js';
import { selectLocalDirectory, type DirectoryPickerResult } from './folderPicker.js';

const LOOPBACK_HOSTS = new Set(['127.0.0.1', 'localhost', '[::1]']);

function isLoopbackOrigin(origin: string | undefined): boolean {
  if (!origin) return true;
  try {
    return LOOPBACK_HOSTS.has(new URL(origin).hostname);
  } catch {
    return false;
  }
}

export function createLocalUiApp(options: { distPath?: string; demoRoot?: string; selectDirectory?: () => Promise<DirectoryPickerResult> } = {}) {
  const app = express();
  const distPath = options.distPath || path.join(process.cwd(), 'dist');
  const previousByConnection = new Map<string, any[]>();
  const demoRoot = options.demoRoot || path.join(process.cwd(), 'demo', 'onboarding-v1');

  app.disable('x-powered-by');
  app.use(express.json({ limit: '4kb', strict: true }));

  app.post('/local-api/select-directory', async (request, response) => {
    if (!isLoopbackOrigin(request.get('origin'))) return response.status(403).json({ error: { code: 'NON_LOCAL_ORIGIN', message: 'Only the local UI may open the directory picker.' } });
    if (request.body && Object.keys(request.body).length) return response.status(400).json({ error: { code: 'PICKER_REQUEST_INVALID', message: 'The directory picker does not accept client commands or paths.' } });
    const result = await (options.selectDirectory || selectLocalDirectory)();
    response.setHeader('cache-control', 'no-store');
    return response.json(result);
  });

  app.post('/local-api/demo-analysis', async (request, response) => {
    if (!isLoopbackOrigin(request.get('origin'))) return response.status(403).json({ error: { code: 'NON_LOCAL_ORIGIN', message: 'Only the local UI may start the bundled demo.' } });
    if (request.body && Object.keys(request.body).length) return response.status(400).json({ error: { code: 'DEMO_REQUEST_INVALID', message: 'The bundled demo does not accept a client-supplied path.' } });
    try {
      const result = await analyzeBundledDemo(demoRoot);
      response.setHeader('cache-control', 'no-store');
      return response.json(result);
    } catch (error) {
      console.error('Bundled demo analysis failed without client-supplied filesystem input.');
      return response.status(500).json({ error: { code: 'DEMO_ANALYSIS_FAILED', message: 'The bundled demo could not be analyzed.' } });
    }
  });

  app.post('/local-api/analyze', async (request, response) => {
    if (!isLoopbackOrigin(request.get('origin'))) {
      return response.status(403).json({ error: { code: 'NON_LOCAL_ORIGIN', message: 'Only the local UI may request analysis.' } });
    }
    if (typeof request.body?.targetPath !== 'string' || request.body.targetPath.trim() === '') {
      return response.status(400).json({ error: { code: 'TARGET_REQUIRED', message: 'Choose an existing local project directory.' } });
    }

    try {
      const runtimeArtifactPath = typeof request.body.runtimeArtifactPath === 'string' && request.body.runtimeArtifactPath.trim()
        ? request.body.runtimeArtifactPath.trim() : undefined;
      const result = await analyzeLocalProject(request.body.targetPath.trim(), { runtimeArtifactPath });
      response.setHeader('cache-control', 'no-store');
      return response.json(result);
    } catch (error) {
      if (error instanceof ProjectAnalysisError || error instanceof RuntimeArtifactError) {
        return response.status(400).json({
          error: { code: error.code, message: error.message, details: 'details' in error ? error.details : [] }
        });
      }
      console.error('Local analysis failed:', error);
      return response.status(500).json({
        error: { code: 'ANALYSIS_FAILED', message: 'The local analysis could not be completed.' }
      });
    }
  });

  app.post('/local-api/connected-n8n', async (request, response) => {
    if (!isLoopbackOrigin(request.get('origin'))) return response.status(403).json({ error: { code: 'NON_LOCAL_ORIGIN', message: 'Only the local UI may request CONNECTED inspection.' } });
    const body = request.body ?? {};
    const tokenEnv = typeof body.tokenEnv === 'string' ? body.tokenEnv : 'N8N_API_KEY';
    if (!/^[A-Z_][A-Z0-9_]*$/.test(tokenEnv)) return response.status(400).json({ error: { code: 'INVALID_TOKEN_ENV', message: 'Token environment variable name is invalid.' } });
    const token = process.env[tokenEnv];
    if (!token) return response.status(400).json({ error: { code: 'TOKEN_ENV_UNAVAILABLE', message: `Environment variable ${tokenEnv} is not available to the local UI process.` } });
    if (![body.targetPath, body.baseUrl, body.workflowId, body.connectionId].every(value => typeof value === 'string' && value.trim())) return response.status(400).json({ error: { code: 'CONNECTED_INPUT_REQUIRED', message: 'Local project, base URL, workflow ID, and connection ID are required.' } });
    const key = `${body.baseUrl}\0${body.connectionId}\0${body.workflowId}`;
    try {
      const result = await analyzeConnectedLocalProject({
        targetPath: body.targetPath, baseUrl: body.baseUrl, workflowId: body.workflowId,
        connectionId: body.connectionId, token, tokenEnv,
        authorityMode: ['TECHNICALLY_READ_ONLY', 'CLIENT_ENFORCED_READ_ONLY'].includes(body.authorityMode) ? body.authorityMode : 'UNKNOWN',
        observedArtifactPath: typeof body.observedArtifactPath === 'string' && body.observedArtifactPath.trim() ? body.observedArtifactPath : undefined,
        runtimeArtifactPath: typeof body.runtimeArtifactPath === 'string' && body.runtimeArtifactPath.trim() ? body.runtimeArtifactPath : undefined,
        allowLoopbackHttp: body.allowLoopbackHttp === true,
        previousConnectedEvidences: previousByConnection.get(key)
      });
      previousByConnection.set(key, result.evidence.filter(item => item.sourceType === 'CONNECTED' && item.data?.observation !== 'ABSENCE_OBSERVED'));
      response.setHeader('cache-control', 'no-store');
      return response.json(result);
    } catch (error) {
      if (error instanceof ProjectAnalysisError || error instanceof ConnectedTransportError) return response.status(400).json({ error: { code: 'code' in error ? error.code : 'CONNECTED_FAILED', message: error.message, details: [] } });
      console.error('CONNECTED analysis failed without sensitive request data.');
      return response.status(500).json({ error: { code: 'CONNECTED_FAILED', message: 'CONNECTED inspection could not be completed.' } });
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
