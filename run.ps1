$ErrorActionPreference = 'Stop'
$projectRoot = Split-Path -Parent $MyInvocation.MyCommand.Path
$backendProcess = $null

Push-Location $projectRoot
try {
    python -m pip install -r backend/requirements.txt
    if ($LASTEXITCODE -ne 0) { throw 'Python dependency installation failed.' }

    Push-Location (Join-Path $projectRoot 'frontend')
    try {
        npm install
        if ($LASTEXITCODE -ne 0) { throw 'Frontend dependency installation failed.' }
    } finally {
        Pop-Location
    }

    $backendProcess = Start-Process -FilePath python -ArgumentList @(
        '-m', 'uvicorn', 'backend.app.main:app', '--host', '127.0.0.1', '--port', '8000'
    ) -WorkingDirectory $projectRoot -WindowStyle Hidden -PassThru

    $ready = $false
    for ($attempt = 0; $attempt -lt 30; $attempt++) {
        try {
            Invoke-RestMethod -Uri 'http://127.0.0.1:8000/api/health' -TimeoutSec 1 | Out-Null
            $ready = $true
            break
        } catch {
            Start-Sleep -Milliseconds 500
        }
    }
    if (-not $ready) {
        throw 'The EEG backend did not start on port 8000.'
    }

    Set-Location (Join-Path $projectRoot 'frontend')
    npm run dev
    if ($LASTEXITCODE -ne 0) { throw 'The Vite development server exited with an error.' }
} finally {
    if ($backendProcess) {
        Stop-Process -Id $backendProcess.Id -Force -ErrorAction SilentlyContinue
    }
    Pop-Location
}
