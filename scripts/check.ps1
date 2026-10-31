$ErrorActionPreference = 'Continue'
$ProjectRoot = Split-Path -Parent $PSScriptRoot
Set-Location $ProjectRoot

Write-Host "`n== Local runtime checks ==" -ForegroundColor Cyan

$Python = Join-Path $ProjectRoot '.venv\Scripts\python.exe'
if (Test-Path $Python) {
  & $Python -c "import sys, faster_whisper; print('Python:', sys.version.split()[0]); print('faster-whisper: installed')"
  if ($LASTEXITCODE -ne 0) { Write-Host 'Speech dependencies: FAILED' -ForegroundColor Red }
} else {
  Write-Host 'Python virtual environment not found. Run .\scripts\setup.ps1' -ForegroundColor Red
}

if (Get-Command ollama -ErrorAction SilentlyContinue) {
  ollama --version
  ollama list
} else {
  Write-Host 'Ollama CLI not found. Install Ollama for Windows.' -ForegroundColor Red
}

try {
  $health = Invoke-RestMethod -Uri 'http://127.0.0.1:11434/api/tags' -TimeoutSec 3
  $model = $health.models | Where-Object { $_.name -like 'qwen2.5:0.5b-instruct*' }
  if ($model) { Write-Host 'Ollama API: online; requested model is downloaded.' -ForegroundColor Green }
  else { Write-Host 'Ollama API: online; run ollama pull qwen2.5:0.5b-instruct' -ForegroundColor Yellow }
} catch {
  Write-Host 'Ollama API is not reachable at http://127.0.0.1:11434. Start the Ollama app.' -ForegroundColor Red
}
