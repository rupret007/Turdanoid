param(
  [int]$Port = 8123,
  [string]$HostName = "127.0.0.1",
  [string]$BrowserChannel = "msedge"
)

$ErrorActionPreference = "Stop"

$server = $null

try {
  $server = Start-Process -FilePath "python" -ArgumentList "-m", "http.server", "$Port", "--bind", $HostName -WorkingDirectory $PSScriptRoot -PassThru -WindowStyle Hidden
  $serverReady = $false
  for ($attempt = 0; $attempt -lt 20; $attempt++) {
    Start-Sleep -Milliseconds 500
    try {
      $response = Invoke-WebRequest -Uri "http://$HostName`:$Port/hub.html" -UseBasicParsing -TimeoutSec 2
      if ($response.StatusCode -eq 200) {
        $serverReady = $true
        break
      }
    } catch {
    }
  }

  if (-not $serverReady) {
    throw "Local HTTP server did not become ready."
  }

  if (-not (Test-Path (Join-Path $PSScriptRoot "node_modules\\playwright"))) {
    throw "Missing Playwright dependency. Run 'cmd /c npm install' first."
  }

  $env:PLAYWRIGHT_CHANNEL = $BrowserChannel
  cmd /c node browser-smoke.js "http://$HostName`:$Port"
  if ($LASTEXITCODE -ne 0) {
    throw "Browser smoke checks failed."
  }
}
finally {
  if ($server -and -not $server.HasExited) {
    Stop-Process -Id $server.Id -Force
  }
}
