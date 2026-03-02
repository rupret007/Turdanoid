# Turdanoid Test Runner - Static validation
# Run with: powershell -ExecutionPolicy Bypass -File test-runner.ps1

$ErrorActionPreference = "Continue"
$passed = 0
$failed = 0

function Pass { param($msg) $script:passed++; Write-Host "  [PASS] $msg" -ForegroundColor Green }
function Fail { param($msg, $detail) $script:failed++; Write-Host "  [FAIL] $msg $detail" -ForegroundColor Red }

Write-Host "`n=== File Existence ===" -ForegroundColor Cyan
@('index.html','hub.html','turdtris.html','TurdAnoid.html','game.js','README.md') | ForEach-Object {
    if (Test-Path $_) { Pass("$_ exists") } else { Fail("$_ missing") }
}

Write-Host "`n=== index.html ===" -ForegroundColor Cyan
$idx = Get-Content index.html -Raw
if ($idx -match 'id="gameCanvas"') { Pass("gameCanvas") } else { Fail("gameCanvas") }
if ($idx -match 'id="score"') { Pass("score") } else { Fail("score") }
if ($idx -match 'id="highScore"') { Pass("highScore") } else { Fail("highScore") }
if ($idx -match 'id="comboDisplay"') { Pass("comboDisplay") } else { Fail("comboDisplay") }
if ($idx -match 'id="muteBtn"') { Pass("muteBtn") } else { Fail("muteBtn") }
if ($idx -match 'game\.js') { Pass("game.js script") } else { Fail("game.js script") }
if ($idx -match 'restartGame') { Pass("restartGame") } else { Fail("restartGame") }
if ($idx -match 'togglePause') { Pass("togglePause") } else { Fail("togglePause") }

Write-Host "`n=== hub.html ===" -ForegroundColor Cyan
$hub = Get-Content hub.html -Raw
if ($hub -match 'href="index\.html"') { Pass("link to index") } else { Fail("link to index") }
if ($hub -match 'href="turdtris\.html"') { Pass("link to turdtris") } else { Fail("link to turdtris") }
if ($hub -match 'href="TurdAnoid\.html"') { Pass("link to TurdAnoid") } else { Fail("link to TurdAnoid") }

Write-Host "`n=== game.js ===" -ForegroundColor Cyan
$game = Get-Content game.js -Raw
if ($game -match 'class Game') { Pass("Game class") } else { Fail("Game class") }
if ($game -match 'gameLoop') { Pass("gameLoop") } else { Fail("gameLoop") }
if ($game -match 'playSound') { Pass("playSound") } else { Fail("playSound") }
if ($game -match 'createPowerUp') { Pass("createPowerUp") } else { Fail("createPowerUp") }
if ($game -match 'checkCollision') { Pass("checkCollision") } else { Fail("checkCollision") }
if ($game -match 'localStorage') { Pass("localStorage") } else { Fail("localStorage") }
if ($game -match 'throw new Error') { Pass("constructor throws") } else { Fail("constructor throws") }
if ($game -match 'webkitAudioContext') { Pass("Safari audio") } else { Fail("Safari audio") }

Write-Host "`n=== turdtris.html ===" -ForegroundColor Cyan
$tris = Get-Content turdtris.html -Raw
if ($tris -match 'let highScore = parseInt') { Pass("highScore declared") } else { Fail("highScore declared") }
if ($tris -match 'if \(canvas\)') { Pass("touch guard") } else { Fail("touch guard") }
if ($tris -match 'Math\.min\(linesClearedThisTurn') { Pass("lineScores bounds") } else { Fail("lineScores bounds") }
if ($tris -match 'if \(!matrix\) return getNextTetromino') { Pass("tetromino fallback") } else { Fail("tetromino fallback") }

Write-Host "`n=== TurdAnoid.html ===" -ForegroundColor Cyan
$turd = Get-Content TurdAnoid.html -Raw
if ($turd -match 'POWERUP_TYPES') { Pass("POWERUP_TYPES") } else { Fail("POWERUP_TYPES") }
if ($turd -match 'toiletPaperShots') { Pass("toiletPaperShots") } else { Fail("toiletPaperShots") }
if ($turd -match 'windowResized') { Pass("windowResized") } else { Fail("windowResized") }
if ($turd -match 'touchStarted') { Pass("touchStarted") } else { Fail("touchStarted") }
if ($turd -match 'viewport') { Pass("viewport meta") } else { Fail("viewport meta") }

Write-Host "`n=== Summary ===" -ForegroundColor Cyan
Write-Host "Passed: $passed" -ForegroundColor Green
Write-Host "Failed: $failed" -ForegroundColor $(if ($failed -gt 0) { "Red" } else { "Green" })
exit $failed
