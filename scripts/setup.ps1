param(
  [switch]$PullModel
)

$ErrorActionPreference = 'Stop'
$ProjectRoot = Split-Path -Parent $PSScriptRoot
Set-Location $ProjectRoot

Write-Host "`n== Parakeet Local Assistant setup ==" -ForegroundColor Cyan

if (-not (Get-Command node -ErrorAction SilentlyContinue)) {
  throw 'Node.js was not found. Install the current Node.js LTS release, reopen PowerShell, and run this script again.'
}
if (-not (Get-Command npm -ErrorAction SilentlyContinue)) {
  throw 'npm was not found. Reinstall Node.js LTS with the npm option enabled.'
}
if (-not (Get-Command python -ErrorAction SilentlyContinue)) {
  throw 'Python was not found. Install Python 3.11 (64-bit), enable "Add Python to PATH", reopen PowerShell, and retry.'
}

$NodeVersion = node -p "process.versions.node"
$NodeParts = $NodeVersion.Split('.')
$NodeMajor = [int]$NodeParts[0]
$NodeMinor = [int]$NodeParts[1]
if ($NodeMajor -lt 22 -or ($NodeMajor -eq 22 -and $NodeMinor -lt 12)) {
  throw "Node.js $NodeVersion detected. Install Node.js 22.12+ (Node.js 24 LTS recommended), then rerun setup."
}
Write-Host "Node: v$NodeVersion"
Write-Host "npm:  $(npm --version)"
$PythonVersion = python -c "import sys; print(f'{sys.version_info.major}.{sys.version_info.minor}')"
Write-Host "Python: $(python --version)"
if ($PythonVersion -notin @('3.10', '3.11', '3.12')) {
  throw "Python $PythonVersion was detected. Install Python 3.11 (64-bit), enable Add Python to PATH, then rerun setup. Supported versions: 3.10, 3.11, 3.12."
}

if (-not (Test-Path '.venv\Scripts\python.exe')) {
  Write-Host "`nCreating Python virtual environment..." -ForegroundColor Yellow
  python -m venv .venv
}

$VenvPython = Join-Path $ProjectRoot '.venv\Scripts\python.exe'
Write-Host "`nInstalling local speech-to-text dependencies..." -ForegroundColor Yellow
& $VenvPython -m pip install --upgrade pip
& $VenvPython -m pip install -r '.\backend\requirements.txt'

Write-Host "`nInstalling desktop application dependencies..." -ForegroundColor Yellow
npm install

if ($PullModel) {
  if (-not (Get-Command ollama -ErrorAction SilentlyContinue)) {
    throw 'Ollama CLI was not found. Install Ollama for Windows, reopen PowerShell, then run .\scripts\setup.ps1 -PullModel.'
  }
  Write-Host "`nDownloading the lightweight Ollama model..." -ForegroundColor Yellow
  ollama pull qwen2.5:0.5b-instruct
}

Write-Host "`nSetup completed." -ForegroundColor Green
Write-Host 'Next: install/start Ollama, run: ollama pull qwen2.5:0.5b-instruct'
Write-Host 'Then run: npm run dev'
