# Parakeet Local Assistant

A Windows desktop prototype inspired by Parakeet AI. It records microphone audio, transcribes it locally with **faster-whisper**, and generates a suggested answer locally with **Ollama**. The answer is displayed progressively as Ollama streams its response.

## Features

- Electron desktop application with a React interface.
- Start and Stop microphone recording.
- Local speech-to-text using faster-whisper (`tiny`, CPU/INT8 by default).
- Local answer generation using Ollama (`qwen2.5:0.5b-instruct` by default).
- Progressive answer display using Ollama's streaming API.
- No hosted speech-to-text or LLM API is used.
- Temporary audio is stored locally for transcription and removed after processing.

> **Hardware note:** The default models are deliberately small for a modest Windows laptop. Close memory-heavy applications before running the app, especially on an 8 GB machine. The first transcription downloads the Whisper Tiny model; the first Ollama setup downloads the LLM. Keep enough free disk space for the project dependencies and both model caches.

## 1. Required tools and versions

Use the following versions or compatible ranges. The JavaScript package versions below correspond to the versions declared in this project's `package.json`.

| Tool / package | Required version | Notes |
|---|---:|---|
| Windows | Windows 10/11, 64-bit | Windows 11 recommended |
| Node.js | **24.x LTS recommended**; minimum **22.12.0** | Vite 8 requires Node 20.19+ or 22.12+ |
| npm | **10.x or newer** | Installed with Node.js |
| Python | **3.11.x, 64-bit recommended** | Setup script supports Python 3.10, 3.11 or 3.12 |
| faster-whisper | **1.1.1** | Python speech-to-text library |
| requests | **2.31.0 or newer** | Explicitly required by the Python backend |
| Ollama | Current stable Windows release | Provides the local model runtime |
| Ollama model | **`qwen2.5:0.5b-instruct`** | Default local answer-generation model |
| Whisper model | **`tiny`** | Downloaded automatically on first transcription |
| React / React DOM | **19.3.1 or compatible `^19.3.1`** | Frontend |
| Electron | **45.2.1 or compatible `^45.2.1`** | Desktop runtime |
| Vite | **8.3.5 or compatible `^8.3.5`** | Frontend build/dev server |
| `@vitejs/plugin-react` | **6.1.2 or compatible `^6.1.2`** | React plugin for Vite |
| `electron-builder` | **26.18.1 or compatible `^26.18.1`** | Optional Windows installer build |
| `dotenv` | **16.4.7 or compatible `^16.4.7`** | Environment configuration |
| `concurrently` | **9.1.2 or compatible `^9.1.2`** | Runs Vite and Electron together |
| `cross-env` | **7.0.3 or compatible `^7.0.3`** | Sets environment variables in npm scripts |
| `wait-on` | **8.0.2 or compatible `^8.0.2`** | Waits for the Vite server |

### Official downloads

- Node.js: <https://nodejs.org/>
- Python for Windows: <https://www.python.org/downloads/windows/>
- Ollama for Windows: <https://ollama.com/download/windows>

During Python installation, enable **Add python.exe to PATH**. After installing the tools, close and reopen PowerShell.

### Verify installed versions

Open PowerShell and run:

```powershell
node --version
npm --version
python --version
ollama --version
```

Expected compatibility:

- Node.js: `v22.12.0` or newer (Node.js 24 LTS recommended).
- npm: `10.0.0` or newer.
- Python: `3.10.x`, `3.11.x` or `3.12.x`, 64-bit (3.11 recommended).
- Ollama: command should return its installed version.

## 2. Get the project

Clone your GitHub repository, or download and extract the source ZIP. Then open PowerShell in the project root — the folder containing `package.json`.

Example:

```powershell
cd D:\parakeet-local-assistant\parakeet-local-assistant
```

## 3. Check the Python requirements file

Ensure `backend\requirements.txt` contains both lines below. The `requests` dependency is important; without it, the backend can fail with `ModuleNotFoundError: No module named 'requests'`.

```text
faster-whisper==1.1.1
requests>=2.31.0
```

A matching `backend/requirements.txt` is included with this README download. If your GitHub repository's file has only `faster-whisper==1.1.1`, add the second line and commit the change.

## 4. Install dependencies for local development

Run these commands from the project root in PowerShell:

```powershell
Set-ExecutionPolicy -Scope Process -ExecutionPolicy Bypass
.\scripts\setup.ps1
```

The setup script:

1. Checks Node.js, npm and Python versions.
2. Creates a project-local Python virtual environment named `.venv`.
3. Installs the Python packages from `backend/requirements.txt` into `.venv`.
4. Installs the Node.js, React and Electron dependencies from `package.json`.

The Python libraries are installed into this project's `.venv`, not into the system-wide Python environment.

### Verify Python dependencies

```powershell
.\.venv\Scripts\python.exe -c "import faster_whisper, requests; print('Python speech dependencies OK')"
```

Expected output:

```text
Python speech dependencies OK
```

### Verify Node dependencies

```powershell
npm list --depth=0
```

If setup completed without errors, the project dependencies should be listed.

> **Dependency reproducibility:** If the repository does not yet contain `package-lock.json`, the first `npm install` creates it. Commit `package-lock.json` to GitHub. After that, use `npm ci` for clean, repeatable installs that follow the committed lockfile. Do not delete or ignore the lockfile.

## 5. Install and download the local LLM

Install and open the Ollama Windows application. Then download the model used by this project:

```powershell
ollama pull qwen2.5:0.5b-instruct
```

Confirm that the model is installed:

```powershell
ollama list
```

The model list should contain `qwen2.5:0.5b-instruct`.

Optional direct test:

```powershell
ollama run qwen2.5:0.5b-instruct "Explain React in two sentences."
```

Exit the interactive Ollama session with `/bye` if needed. Ollama normally runs its local API at `http://127.0.0.1:11434`.

## 6. Run the project locally

Make sure Ollama is running and the model is downloaded. In the project root, run:

```powershell
npm run dev
```

Vite starts the React development server, and Electron opens the desktop window. Keep the terminal running while using the app.

### Use the application

1. Wait for the **Parakeet Local Assistant** window to open.
2. Check the Runtime Check area. Python/Whisper and Ollama should both show as ready.
3. Click **Start** and allow microphone access if Windows asks.
4. Speak a question clearly.
5. Click **Stop**. The audio is transcribed locally and the text appears in the transcription area.
6. Review the transcription.
7. Click **Suggest Answer**. The generated answer should appear progressively as Ollama streams it.
8. Click **Clear** to reset the interface and test another question.

The first transcription downloads the Whisper Tiny model to the local Hugging Face cache. This is a model download only; microphone audio is processed locally and is not uploaded to a hosted speech service. The transcript is sent to the local Ollama API on the same computer.

## 7. Test commands

Run these commands from the project root.

### Test the Python backend dependencies

```powershell
.\.venv\Scripts\python.exe -c "import faster_whisper, requests; print('faster-whisper and requests OK')"
```

### Check Ollama and its API

```powershell
ollama list
Invoke-RestMethod http://127.0.0.1:11434/api/tags
```

### Run the project's runtime checks

```powershell
.\scripts\check.ps1
```

### Run automated tests

```powershell
npm test
```

The automated tests cover Ollama stream chunk parsing and missing-model error handling. They do not replace an end-to-end microphone test.

### Build the React frontend

```powershell
npm run build
```

The production frontend files are written to `dist/`.

## 8. Optional: build the Windows installer

The assignment can be demonstrated by running locally with `npm run dev`; you do not need to build an installer for local development.

To build the NSIS installer:

```powershell
npm run dist:win
```

In the original project configuration, Electron Builder writes the installer under `dist/`. If you later add `build.directories.output` in `package.json`, it will use that configured folder instead.

**Packaging limitation:** This prototype's Windows installer packages the Electron application and transcription script, but it does not bundle the Python runtime, Python packages, Ollama, or the downloaded AI models. The installed application therefore needs a compatible Python installation with the requirements installed, and Ollama with the model pulled. The local development workflow in this README uses the project's `.venv` and is the recommended way to run the source code.

## 9. Configuration

Copy the example environment file if you need to override defaults:

```powershell
Copy-Item .env.example .env
```

For local development, put `.env` beside `package.json`.

| Variable | Default | Purpose |
|---|---|---|
| `OLLAMA_BASE_URL` | `http://127.0.0.1:11434` | Local Ollama API URL |
| `OLLAMA_MODEL` | `qwen2.5:0.5b-instruct` | Ollama model tag |
| `WHISPER_MODEL` | `tiny` | faster-whisper model size/name |
| `WHISPER_CPU_THREADS` | `4` | CPU threads used for transcription |
| `PARAKEET_PYTHON` | Project `.venv` Python when available; otherwise `python` | Optional Python executable override |

The default model sizes are chosen for a low-memory computer. Larger models may improve quality but require more disk space and RAM.

## 10. Troubleshooting

### `ModuleNotFoundError: No module named 'faster_whisper'`

Run the setup script again and check that the project-local environment exists:

```powershell
.\scripts\setup.ps1
.\.venv\Scripts\python.exe -c "import faster_whisper; print('faster-whisper OK')"
```

### `ModuleNotFoundError: No module named 'requests'`

Check that `requests>=2.31.0` is in `backend/requirements.txt`, then run:

```powershell
.\.venv\Scripts\python.exe -m pip install -r .\backend\requirements.txt
.\.venv\Scripts\python.exe -c "import requests; print('requests OK')"
```

### Runtime check says Ollama is offline

Open the Ollama application, then run:

```powershell
ollama list
Invoke-RestMethod http://127.0.0.1:11434/api/tags
```

### Ollama says the model is missing

```powershell
ollama pull qwen2.5:0.5b-instruct
```

### Microphone permission is denied

Open **Windows Settings → Privacy & security → Microphone** and enable microphone access, including access for desktop apps. Check that the correct microphone is selected in Windows Sound settings.

### Transcription is slow or the laptop runs out of memory

Close browsers, IDEs and other memory-heavy applications. Keep the Whisper model set to `tiny` and use `qwen2.5:0.5b-instruct`. The app runs transcription and LLM generation sequentially.

### Ollama answers are low quality

The 0.5B model is intentionally small and can make mistakes. A larger model may give better answers but uses more RAM and disk space. For this laptop, keep the default model unless you have sufficient free memory.

## 11. Project structure

```text
parakeet-local-assistant/
├── backend/
│   ├── requirements.txt
│   └── transcribe.py
├── electron/
│   ├── main.cjs
│   ├── preload.cjs
│   ├── ollama-client.cjs
│   └── ollama-client.test.cjs
├── scripts/
│   ├── setup.ps1
│   └── check.ps1
├── src/
│   ├── App.jsx
│   ├── main.jsx
│   └── styles.css
├── .env.example
├── .gitignore
├── index.html
├── package.json
├── package-lock.json  # commit this after the first npm install
├── vite.config.js
└── README.md
```

## 12. Architecture

```text
Electron desktop window
        │
        ├── React UI
        │     ├── Start / Stop buttons
        │     ├── Transcription panel
        │     └── Streaming answer panel
        │
        ├── Microphone audio (MediaRecorder)
        │        │
        │        ▼
        │   Temporary WebM file
        │        │
        │        ▼
        │   Python + faster-whisper (CPU / INT8)
        │        │
        │        ▼
        │   Transcribed question
        │        │
        │        ▼
        │   Local Ollama /api/chat (stream=true)
        │        │
        │        ▼
        └── Progressive answer chunks → React UI
```

## Assignment notes

- **Speech-to-text runs locally:** faster-whisper executes as a local Python process.
- **LLM inference runs locally:** Ollama serves the selected model from `127.0.0.1`; no hosted AI API key is used.
- **Streaming is supported:** Ollama response chunks are forwarded progressively to the React UI through Electron IPC.
- **Prototype scope:** No login, database, cloud account, or remote speech/LLM service is required.
