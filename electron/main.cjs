const { app, BrowserWindow, ipcMain, session } = require('electron');
const path = require('node:path');
const fs = require('node:fs');
const os = require('node:os');
const { spawn } = require('node:child_process');
const crypto = require('node:crypto');
const dotenv = require('dotenv');
const { streamOllamaChat } = require('./ollama-client.cjs');

let mainWindow;

function projectRoot() {
  return app.getAppPath();
}

function loadEnvironment() {
  const envPath = app.isPackaged
    ? path.join(app.getPath('userData'), '.env')
    : path.join(projectRoot(), '.env');
  dotenv.config({ path: envPath });
}

function getBackendScript() {
  return app.isPackaged
    ? path.join(process.resourcesPath, 'backend', 'transcribe.py')
    : path.join(projectRoot(), 'backend', 'transcribe.py');
}

function getPythonCommand() {
  if (process.env.PARAKEET_PYTHON) {
    return { command: process.env.PARAKEET_PYTHON, prefixArgs: [] };
  }

  const virtualEnvPython = path.join(projectRoot(), '.venv', 'Scripts', 'python.exe');
  if (process.platform === 'win32' && fs.existsSync(virtualEnvPython)) {
    return { command: virtualEnvPython, prefixArgs: [] };
  }
  return { command: process.platform === 'win32' ? 'python' : 'python3', prefixArgs: [] };
}

function runPython(args, { timeoutMs = 5 * 60 * 1000 } = {}) {
  const python = getPythonCommand();
  return new Promise((resolve, reject) => {
    const child = spawn(python.command, [...python.prefixArgs, ...args], {
      windowsHide: true,
      env: {
        ...process.env,
        WHISPER_MODEL: process.env.WHISPER_MODEL || 'tiny',
        WHISPER_CPU_THREADS: process.env.WHISPER_CPU_THREADS || '4'
      }
    });
    let stdout = '';
    let stderr = '';
    const timeout = setTimeout(() => {
      child.kill();
      reject(new Error('Transcription timed out after 5 minutes. Try a shorter recording.'));
    }, timeoutMs);

    child.stdout.on('data', (chunk) => { stdout += chunk.toString(); });
    child.stderr.on('data', (chunk) => { stderr += chunk.toString(); });
    child.on('error', (error) => {
      clearTimeout(timeout);
      reject(new Error(`Could not start Python (${python.command}). Install Python 3.11 and run scripts\\setup.ps1. Details: ${error.message}`));
    });
    child.on('close', (code) => {
      clearTimeout(timeout);
      if (code !== 0) {
        reject(new Error(stderr.trim() || `Speech recognition exited with code ${code}.`));
        return;
      }
      try {
        resolve(JSON.parse(stdout.trim()));
      } catch {
        reject(new Error(`Speech recognition returned an invalid result. ${stderr.slice(-1200)}`));
      }
    });
  });
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1120,
    height: 820,
    minWidth: 760,
    minHeight: 650,
    title: 'Parakeet Local Assistant',
    backgroundColor: '#0b1020',
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true
    }
  });

  if (process.env.VITE_DEV_SERVER_URL) {
    mainWindow.loadURL(process.env.VITE_DEV_SERVER_URL);
  } else {
    mainWindow.loadFile(path.join(projectRoot(), 'dist', 'index.html'));
  }
}

app.whenReady().then(() => {
  loadEnvironment();

  // Allow the renderer to request microphone access, but no other permission.
  session.defaultSession.setPermissionRequestHandler((_webContents, permission, callback) => {
    callback(permission === 'media');
  });
  session.defaultSession.setPermissionCheckHandler((_webContents, permission) => permission === 'media');

  ipcMain.handle('transcribe-audio', async (_event, audioBytes) => {
    if (!audioBytes) throw new Error('No audio data was received. Record a question and try again.');
    const audioBuffer = Buffer.from(audioBytes);
    if (audioBuffer.length < 1000) throw new Error('The recording is empty or too short. Please record again.');
    if (audioBuffer.length > 30 * 1024 * 1024) throw new Error('Recording is larger than 30 MB. Please record a shorter question.');

    const extension = 'webm';
    const audioPath = path.join(os.tmpdir(), `parakeet-${crypto.randomUUID()}.${extension}`);
    try {
      await fs.promises.writeFile(audioPath, audioBuffer);
      return await runPython([getBackendScript(), audioPath]);
    } finally {
      await fs.promises.rm(audioPath, { force: true }).catch(() => {});
    }
  });

  ipcMain.handle('suggest-answer', async (event, question) => {
    const trimmedQuestion = String(question || '').trim();
    if (!trimmedQuestion) throw new Error('There is no transcribed question to answer.');
    if (trimmedQuestion.length > 6000) throw new Error('The transcribed question is too long. Please shorten it.');

    const answer = await streamOllamaChat({
      baseUrl: process.env.OLLAMA_BASE_URL || 'http://127.0.0.1:11434',
      model: process.env.OLLAMA_MODEL || 'qwen2.5:0.5b-instruct',
      question: trimmedQuestion,
      onToken: (token) => {
        if (!event.sender.isDestroyed()) event.sender.send('answer:chunk', token);
      }
    });
    if (!event.sender.isDestroyed()) event.sender.send('answer:done');
    return { ok: true, answer };
  });

  ipcMain.handle('get-runtime-status', async () => {
    const python = getPythonCommand();
    let pythonStatus = { available: false, version: null, error: null };
    // Direct check returns plain text, so it intentionally uses spawn rather than runPython's JSON parser.
    try {
      const versionOutput = await new Promise((resolve, reject) => {
        const child = spawn(python.command, ['-c', 'import sys, faster_whisper; print(sys.version.split()[0])'], { windowsHide: true });
        let output = '';
        let errorText = '';
        child.stdout.on('data', (chunk) => { output += chunk.toString(); });
        child.stderr.on('data', (chunk) => { errorText += chunk.toString(); });
        child.on('error', reject);
        child.on('close', (code) => code === 0 ? resolve(output.trim()) : reject(new Error(errorText.trim() || 'Python dependency check failed.')));
      });
      pythonStatus = { available: true, version: versionOutput, error: null };
    } catch (error) {
      pythonStatus = { available: false, version: null, error: error.message };
    }

    const model = process.env.OLLAMA_MODEL || 'qwen2.5:0.5b-instruct';
    let ollamaStatus = { available: false, modelInstalled: false, model, error: null };
    try {
      const baseUrl = process.env.OLLAMA_BASE_URL || 'http://127.0.0.1:11434';
      const response = await fetch(`${baseUrl.replace(/\/$/, '')}/api/tags`);
      if (!response.ok) throw new Error(`Ollama returned HTTP ${response.status}`);
      const payload = await response.json();
      const models = Array.isArray(payload.models) ? payload.models : [];
      ollamaStatus = {
        available: true,
        modelInstalled: models.some((item) => item.name === model || item.name?.startsWith(`${model}:`)),
        model,
        error: null
      };
    } catch (error) {
      ollamaStatus.error = error.message;
    }

    return { python: pythonStatus, ollama: ollamaStatus };
  });

  createWindow();
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});
