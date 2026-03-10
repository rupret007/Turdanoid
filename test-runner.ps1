# Turdanoid Test Runner - Static validation
# Run with: powershell -ExecutionPolicy Bypass -File test-runner.ps1

$ErrorActionPreference = "Continue"
$passed = 0
$failed = 0

function Pass { param($msg) $script:passed++; Write-Host "  [PASS] $msg" -ForegroundColor Green }
function Fail { param($msg, $detail) $script:failed++; Write-Host "  [FAIL] $msg $detail" -ForegroundColor Red }

Write-Host "`n=== File Existence ===" -ForegroundColor Cyan
@('index.html','hub.html','turdtris.html','TurdAnoid.html','turdjack.html','turdrummy.html','turdspades.html','game.js','README.md') | ForEach-Object {
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
if ($idx -match 'mobile-menu') { Pass("mobile menu ui") } else { Fail("mobile menu ui") }
if ($idx -match 'quickStartPlay') { Pass("quick start handler") } else { Fail("quick start handler") }

Write-Host "`n=== hub.html ===" -ForegroundColor Cyan
$hub = Get-Content hub.html -Raw
if ($hub -match 'href="turdtris\.html"') { Pass("link to turdtris") } else { Fail("link to turdtris") }
if ($hub -match 'href="TurdAnoid\.html"') { Pass("link to TurdAnoid") } else { Fail("link to TurdAnoid") }
if ($hub -match 'href="turdjack\.html"') { Pass("link to turdjack") } else { Fail("link to turdjack") }
if ($hub -match 'href="turdrummy\.html"') { Pass("link to turdrummy") } else { Fail("link to turdrummy") }
if ($hub -match 'href="turdspades\.html"') { Pass("link to turdspades") } else { Fail("link to turdspades") }
if ($hub -match '(?s)<div class="games">\s*<a href="TurdAnoid\.html"') { Pass("TurdAnoid is first card") } else { Fail("TurdAnoid is first card") }
if ($hub -notmatch 'Neon Arkanoid') { Pass("Neon removed from hub cards") } else { Fail("Neon removed from hub cards") }

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
if ($game -match 'maxLevel') { Pass("level cap logic") } else { Fail("level cap logic") }
if ($game -match 'setupWaldo') { Pass("waldo cameo logic") } else { Fail("waldo cameo logic") }
if ($game -match 'NEON_BALANCE') { Pass("balance config") } else { Fail("balance config") }
if ($game -match 'applyLevelMutators') { Pass("level mutator hook") } else { Fail("level mutator hook") }
if ($game -match 'blocksSinceDrop') { Pass("drop drought logic") } else { Fail("drop drought logic") }
if ($game -match 'patternCount') { Pass("expanded pattern count") } else { Fail("expanded pattern count") }

Write-Host "`n=== turdtris.html ===" -ForegroundColor Cyan
$tris = Get-Content turdtris.html -Raw
if ($tris -match 'let highScore = parseInt') { Pass("highScore declared") } else { Fail("highScore declared") }
if ($tris -match 'if \(canvas\)') { Pass("touch guard") } else { Fail("touch guard") }
if ($tris -match 'Math\.min\(linesClearedThisTurn') { Pass("lineScores bounds") } else { Fail("lineScores bounds") }
if ($tris -match 'if \(!matrix\) return getNextTetromino') { Pass("tetromino fallback") } else { Fail("tetromino fallback") }
if ($tris -match 'getLinesGoalForLevel') { Pass("variable level goals") } else { Fail("variable level goals") }
if ($tris -match 'TURDTRIS_BALANCE') { Pass("balance config") } else { Fail("balance config") }
if ($tris -match 'buildLevelMutator') { Pass("mutator builder") } else { Fail("mutator builder") }
if ($tris -match 'quickStartRun') { Pass("quick start handler") } else { Fail("quick start handler") }
if ($tris -match 'data-action=\"pause\"') { Pass("mobile pause control") } else { Fail("mobile pause control") }
if ($tris -match 'const MAX_LEVEL = 69;') { Pass("max level cap") } else { Fail("max level cap") }
if ($tris -match 'showGameOver\(true\);') { Pass("level 69 win path") } else { Fail("level 69 win path") }

Write-Host "`n=== TurdAnoid.html ===" -ForegroundColor Cyan
$turd = Get-Content TurdAnoid.html -Raw
if ($turd -match 'POWERUP_TYPES') { Pass("POWERUP_TYPES") } else { Fail("POWERUP_TYPES") }
if ($turd -match 'toiletPaperShots') { Pass("toiletPaperShots") } else { Fail("toiletPaperShots") }
if ($turd -match 'windowResized') { Pass("windowResized") } else { Fail("windowResized") }
if ($turd -match 'touchStarted') { Pass("touchStarted") } else { Fail("touchStarted") }
if ($turd -match 'viewport') { Pass("viewport meta") } else { Fail("viewport meta") }
if ($turd -match 'MAX_LEVEL') { Pass("max level cap") } else { Fail("max level cap") }
if ($turd -match 'levelLayoutSignatures') { Pass("non-repeating level signatures") } else { Fail("non-repeating level signatures") }
if ($turd -match 'setupWaldoCameo') { Pass("waldo cameo logic") } else { Fail("waldo cameo logic") }
if ($turd -match 'TURDANOID_BALANCE') { Pass("balance config") } else { Fail("balance config") }
if ($turd -match 'quickStartRun') { Pass("quick start handler") } else { Fail("quick start handler") }
if ($turd -match 'Vortex Cage') { Pass("expanded pattern set") } else { Fail("expanded pattern set") }
if ($turd -match 'if \(prevW <= 0 \|\| prevH <= 0\) return;') { Pass("resize guard") } else { Fail("resize guard") }
if ($turd -match 'if \(powerUps\.length >= maxDrops\) return false;' -and $turd -match 'powerUps\.push\(\{ x: x - 15, y, w: 30, h: 30, vy: 2\.1, angle: 0, \.\.\.p \}\);\s*return true;') { Pass("power-up spawn returns success") } else { Fail("power-up spawn returns success") }
if ($turd -match 'targets\.push\(bricks\[i\]\)') { Pass("warp flush stable targets") } else { Fail("warp flush stable targets") }
if ($turd -match 'buckets\.get\(key\)\.push\(b\)') { Pass("row flush stable targets") } else { Fail("row flush stable targets") }
if ($turd -match 'const directionalControlActive = controlLeft \|\| controlRight;') { Pass("control precedence fix") } else { Fail("control precedence fix") }

Write-Host "`n=== turdjack.html ===" -ForegroundColor Cyan
$jack = Get-Content turdjack.html -Raw
if ($jack -match 'bankroll') { Pass("bankroll") } else { Fail("bankroll") }
if ($jack -match 'double') { Pass("double action") } else { Fail("double action") }
if ($jack -match 'split') { Pass("split action") } else { Fail("split action") }
if ($jack -match 'surrender') { Pass("surrender action") } else { Fail("surrender action") }
if ($jack -match 'hintText') { Pass("strategy hint ui") } else { Fail("strategy hint ui") }
if ($jack -match 'ruleDealer17') { Pass("table rule controls") } else { Fail("table rule controls") }
if ($jack -match 'blackjackPayout') { Pass("payout rule logic") } else { Fail("payout rule logic") }
if ($jack -match 'allowInsurance') { Pass("insurance rule logic") } else { Fail("insurance rule logic") }
if ($jack -match 'localStorage') { Pass("localStorage") } else { Fail("localStorage") }
if ($jack -match 'dealer') { Pass("dealer logic") } else { Fail("dealer logic") }
if ($jack -match 'dealerHitsSoft17') { Pass("soft17 rule flag") } else { Fail("soft17 rule flag") }
if ($jack -match 'randomIntExclusive') { Pass("secure shuffle helper") } else { Fail("secure shuffle helper") }
if ($jack -match 'viewport') { Pass("viewport meta") } else { Fail("viewport meta") }
if ($jack -match 'quickStartRound') { Pass("quick start handler") } else { Fail("quick start handler") }
if ($jack -match 'id=\"quickGuideBtn\"') { Pass("guide quick start button") } else { Fail("guide quick start button") }
if ($jack -match 'data-mobile-action=\"smart\"') { Pass("smart mobile action") } else { Fail("smart mobile action") }
if ($jack -match '(?s)function newShoe\(\)\s*\{.*?updateHud\(\);') { Pass("new shoe hud refresh") } else { Fail("new shoe hud refresh") }

Write-Host "`n=== turdrummy.html ===" -ForegroundColor Cyan
$rummy = Get-Content turdrummy.html -Raw
if ($rummy -match 'Gin Rummy') { Pass("gin rummy title") } else { Fail("gin rummy title") }
if ($rummy -match 'viewport') { Pass("viewport meta") } else { Fail("viewport meta") }
if ($rummy -match 'TURDRUMMY_BALANCE') { Pass("balance config") } else { Fail("balance config") }
if ($rummy -match 'analyzeHand') { Pass("meld/deadwood analyzer") } else { Fail("meld/deadwood analyzer") }
if ($rummy -match 'applyLayoff') { Pass("layoff logic") } else { Fail("layoff logic") }
if ($rummy -match 'finishRound') { Pass("round scoring flow") } else { Fail("round scoring flow") }
if ($rummy -match 'data-mobile-action=\"draw-stock\"') { Pass("mobile draw control") } else { Fail("mobile draw control") }
if ($rummy -match 'data-mobile-action=\"gin\"') { Pass("mobile gin control") } else { Fail("mobile gin control") }
if ($rummy -match 'quickGuideBtn') { Pass("rules guide button") } else { Fail("rules guide button") }
if ($rummy -match 'localStorage') { Pass("localStorage stats") } else { Fail("localStorage stats") }
if ($rummy -match 'resolveStockStall') { Pass("stock stall resolution") } else { Fail("stock stall resolution") }
if ($rummy -match 'state\.discard\.length === 0') { Pass("stock draw fallback message path") } else { Fail("stock draw fallback message path") }
if ($rummy -match 'function search\(index, melds, keptCards, laidOffCards, deadwoodScore\)') { Pass("layoff backtracking") } else { Fail("layoff backtracking") }

Write-Host "`n=== turdspades.html ===" -ForegroundColor Cyan
$spades = Get-Content turdspades.html -Raw
if ($spades -match 'TurdSpades') { Pass("turdspades title") } else { Fail("turdspades title") }
if ($spades -match 'viewport') { Pass("viewport meta") } else { Fail("viewport meta") }
if ($spades -match 'const TARGET = 250') { Pass("match target") } else { Fail("match target") }
if ($spades -match 'runBidFlow') { Pass("bidding flow") } else { Fail("bidding flow") }
if ($spades -match 'legalCards') { Pass("legal card rules") } else { Fail("legal card rules") }
if ($spades -match 'scoreRound') { Pass("round scoring") } else { Fail("round scoring") }
if ($spades -match 'state\.spadesBroken') { Pass("spades break logic") } else { Fail("spades break logic") }
if ($spades -match 'Play Selected') { Pass("mobile action") } else { Fail("mobile action") }
if ($spades -match 'guide') { Pass("rules guide overlay") } else { Fail("rules guide overlay") }

Write-Host "`n=== Summary ===" -ForegroundColor Cyan
Write-Host "Passed: $passed" -ForegroundColor Green
Write-Host "Failed: $failed" -ForegroundColor $(if ($failed -gt 0) { "Red" } else { "Green" })
exit $failed
