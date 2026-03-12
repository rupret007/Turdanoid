# Turdanoid Test Runner - Static validation
# Run with: powershell -ExecutionPolicy Bypass -File test-runner.ps1

$ErrorActionPreference = "Continue"
$passed = 0
$failed = 0

function Pass { param($msg) $script:passed++; Write-Host "  [PASS] $msg" -ForegroundColor Green }
function Fail { param($msg, $detail) $script:failed++; Write-Host "  [FAIL] $msg $detail" -ForegroundColor Red }

Write-Host "`n=== File Existence ===" -ForegroundColor Cyan
@('index.html','hub.html','turdtris.html','TurdAnoid.html','turdjack.html','crapeights.html','turdrummy.html','turdspades.html','game.js','README.md') | ForEach-Object {
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
if ($hub -match 'href="crapeights\.html"') { Pass("link to crapeights") } else { Fail("link to crapeights") }
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
if ($game -match '(?s)handleVirtualControl\(event, isPressed\).*?if \(!isPressed\)\s*\{.*?this\.controls\.left = false;\s*this\.controls\.right = false;\s*return;') { Pass("virtual control release reset") } else { Fail("virtual control release reset") }
if ($game -match "if \(action === 'left'\) \{\s*this\.controls\.left = true;\s*this\.controls\.right = false;") { Pass("virtual control left exclusivity") } else { Fail("virtual control left exclusivity") }
if ($game -match "if \(action === 'right'\) \{\s*this\.controls\.right = true;\s*this\.controls\.left = false;") { Pass("virtual control right exclusivity") } else { Fail("virtual control right exclusivity") }
if ($game -match 'const overdriveActive = this\.activePowerUps && this\.activePowerUps\.overdrive > 0;') { Pass("base speed overdrive guard") } else { Fail("base speed overdrive guard") }

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
if ($tris -match 'const clearHoldInterval = \(\) =>') { Pass("mobile hold interval helper") } else { Fail("mobile hold interval helper") }
if ($tris -match 'clearHoldInterval\(\);') { Pass("mobile hold interval reset") } else { Fail("mobile hold interval reset") }
if ($tris -match 'let sceneShake = 0;') { Pass("scene shake state") } else { Fail("scene shake state") }
if ($tris -match 'function setHype\(') { Pass("hype helper") } else { Fail("hype helper") }
if ($tris -match 'function getDangerRatio\(') { Pass("danger ratio helper") } else { Fail("danger ratio helper") }
if ($tris -match 'name: ''Abyss Funnel''') { Pass("late abyss mutator") } else { Fail("late abyss mutator") }
if ($tris -match 'DANGER: stack is feral\.') { Pass("danger status messaging") } else { Fail("danger status messaging") }
if ($tris -match 'const SOUND_STORAGE_KEY = ''turdtrisSoundOn_v1'';') { Pass("turdtris sound storage key") } else { Fail("turdtris sound storage key") }
if ($tris -match 'function toggleSound\(') { Pass("turdtris sound toggle handler") } else { Fail("turdtris sound toggle handler") }
if ($tris -match 'data-sound-toggle') { Pass("turdtris sound toggle buttons") } else { Fail("turdtris sound toggle buttons") }
if ($tris -match 'if \(e\.code === ''KeyM''\)') { Pass("turdtris keybind sound toggle") } else { Fail("turdtris keybind sound toggle") }
if ($tris -match 'statusEl\.classList\.toggle\(''hype'', hypeTimer > 0\);') { Pass("turdtris hype status class") } else { Fail("turdtris hype status class") }

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
if ($turd -match 'const clearHoldTimer = \(\) =>') { Pass("mobile hold timer helper") } else { Fail("mobile hold timer helper") }
if ($turd -match 'clearHoldTimer\(\);') { Pass("mobile hold timer reset") } else { Fail("mobile hold timer reset") }
if ($turd -match '\.mobile-controls\s*\{[^}]*touch-action:\s*none;') { Pass("mobile controls touch-action lock") } else { Fail("mobile controls touch-action lock") }
if ($turd -match 'let mouseInputActive = true;') { Pass("mouse input activity guard") } else { Fail("mouse input activity guard") }
if ($turd -match 'mouseInputActive = false;\s*paddle\.x = constrain\(touches\[0\]\.x - paddleWidth / 2') { Pass("touch input disables mouse fallback") } else { Fail("touch input disables mouse fallback") }
if ($turd -match 'else if \(mouseInputActive\) \{') { Pass("mouse fallback gated by activity") } else { Fail("mouse fallback gated by activity") }
if ($turd -match 'function mouseMoved\(\)\s*\{\s*mouseInputActive = true;\s*\}') { Pass("mouse moved re-enables mouse input") } else { Fail("mouse moved re-enables mouse input") }
if ($turd -match 'mobileControls\.addEventListener\(''pointerdown'', \(e\) => \{\s*e\.preventDefault\(\);') { Pass("mobile pointerdown prevents default") } else { Fail("mobile pointerdown prevents default") }
if ($turd -match 'let screenShake = 0;') { Pass("turdanoid scene shake state") } else { Fail("turdanoid scene shake state") }
if ($turd -match 'function setHype\(') { Pass("turdanoid hype helper") } else { Fail("turdanoid hype helper") }
if ($turd -match 'function triggerShake\(') { Pass("turdanoid shake helper") } else { Fail("turdanoid shake helper") }
if ($turd -match 'const speedRamp = min\(1\.5, pressureRamp \* levelRamp\);') { Pass("turdanoid late pressure speed ramp") } else { Fail("turdanoid late pressure speed ramp") }
if ($turd -match 'Hype:') { Pass("turdanoid hype status tag") } else { Fail("turdanoid hype status tag") }
if ($turd -match 'const SOUND_STORAGE_KEY = ''turdanoidSoundOn_v1'';') { Pass("turdanoid sound storage key") } else { Fail("turdanoid sound storage key") }
if ($turd -match 'function toggleSound\(') { Pass("turdanoid sound toggle handler") } else { Fail("turdanoid sound toggle handler") }
if ($turd -match 'data-sound-toggle') { Pass("turdanoid sound toggle buttons") } else { Fail("turdanoid sound toggle buttons") }
if ($turd -match 'comboCardEl\.classList\.toggle\(''combo-live'', combo >= 4\);') { Pass("turdanoid combo highlight class") } else { Fail("turdanoid combo highlight class") }
if ($turd -match 'statusEl\.classList\.toggle\(''hype'', hypeTimer > 0\);') { Pass("turdanoid hype status class") } else { Fail("turdanoid hype status class") }

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
if ($jack -match '(?s)function newShoe\(\)\s*\{\s*if\s*\(roundActive\)\s*\{\s*setStatus\([^)]*\);\s*updateHud\(\);\s*return;') { Pass("new shoe blocked-path hud refresh") } else { Fail("new shoe blocked-path hud refresh") }
if ($jack -match '(?s)function newShoe\(\)\s*\{.*?createShoe\([^)]*\);\s*setStatus\([^)]*\);\s*logHistory\([^)]*\);.*?updateHud\(\);') { Pass("new shoe success-path hud refresh") } else { Fail("new shoe success-path hud refresh") }
if ($jack -match '(?s)function playerDouble\(\)\s*\{.*?if \(!firstDecisionOpen \|\| hand\.length !== 2\)\s*\{') { Pass("double restricted to first decision") } else { Fail("double restricted to first decision") }
if ($jack -match '(?s)function playerDouble\(\)\s*\{.*?if \(bankroll < activeBet\)\s*\{') { Pass("double bankroll guard") } else { Fail("double bankroll guard") }
if ($jack -match '(?s)function playerSplit\(\)\s*\{.*?if \(splitRound\)\s*\{\s*setStatus\(') { Pass("split one-time guard") } else { Fail("split one-time guard") }
if ($jack -match '(?s)function playerSplit\(\)\s*\{.*?if \(bankroll < currentBet\)\s*\{') { Pass("split bankroll guard") } else { Fail("split bankroll guard") }
if ($jack -match '(?s)function playerSurrender\(\)\s*\{.*?if \(splitRound\)\s*\{\s*setStatus\(') { Pass("surrender blocked after split") } else { Fail("surrender blocked after split") }
if ($jack -match 'let hotStreak = 0;') { Pass("hot streak state") } else { Fail("hot streak state") }
if ($jack -match 'let coldStreak = 0;') { Pass("cold streak state") } else { Fail("cold streak state") }
if ($jack -match 'function recordMomentum\(') { Pass("momentum helper") } else { Fail("momentum helper") }
if ($jack -match 'function getTableFlavor\(') { Pass("table flavor helper") } else { Fail("table flavor helper") }
if ($jack -match 'Table vibe:') { Pass("dynamic table vibe hint") } else { Fail("dynamic table vibe hint") }
if ($jack -match 'const SOUND_STORAGE_KEY = ''turdjackSoundOn_v1'';') { Pass("turdjack sound storage key") } else { Fail("turdjack sound storage key") }
if ($jack -match 'function toggleSound\(') { Pass("turdjack sound toggle handler") } else { Fail("turdjack sound toggle handler") }
if ($jack -match 'data-sound-toggle') { Pass("turdjack sound toggle buttons") } else { Fail("turdjack sound toggle buttons") }
if ($jack -match 'function pulseStatus\(') { Pass("turdjack status pulse helper") } else { Fail("turdjack status pulse helper") }
if ($jack -match '(?s)function setStatus\(text\)\s*\{\s*ui\.statusText\.textContent = text;\s*pulseStatus\(\);') { Pass("turdjack status pulse integration") } else { Fail("turdjack status pulse integration") }
if ($jack -match 'if \(e\.code === ''KeyM''\)') { Pass("turdjack keybind sound toggle") } else { Fail("turdjack keybind sound toggle") }

Write-Host "`n=== crapeights.html ===" -ForegroundColor Cyan
$eight = Get-Content crapeights.html -Raw
if ($eight -match 'Crappy Eights') { Pass("crapeights title") } else { Fail("crapeights title") }
if ($eight -match 'viewport') { Pass("crapeights viewport meta") } else { Fail("crapeights viewport meta") }
if ($eight -match 'const MATCH_TARGET = 200;') { Pass("crapeights match target") } else { Fail("crapeights match target") }
if ($eight -match 'const STARTING_HAND = 7;') { Pass("crapeights opening hand size") } else { Fail("crapeights opening hand size") }
if ($eight -match 'function chooseBestCard\(') { Pass("crapeights ai card chooser") } else { Fail("crapeights ai card chooser") }
if ($eight -match 'function runAiTurn\(') { Pass("crapeights ai turn loop") } else { Fail("crapeights ai turn loop") }
if ($eight -match 'function startRound\(') { Pass("crapeights round start flow") } else { Fail("crapeights round start flow") }
if ($eight -match 'function endRound\(') { Pass("crapeights round end flow") } else { Fail("crapeights round end flow") }
if ($eight -match 'function showWelcomeGuide\(') { Pass("crapeights onboarding guide") } else { Fail("crapeights onboarding guide") }
if ($eight -match 'function toggleSound\(') { Pass("crapeights sound toggle handler") } else { Fail("crapeights sound toggle handler") }
if ($eight -match 'data-sound-toggle') { Pass("crapeights sound toggle buttons") } else { Fail("crapeights sound toggle buttons") }
if ($eight -match 'data-suit=') { Pass("crapeights wild suit chooser") } else { Fail("crapeights wild suit chooser") }
if ($eight -match 'localStorage') { Pass("crapeights localStorage persistence") } else { Fail("crapeights localStorage persistence") }
if ($eight -match 'id="smartBtn"') { Pass("crapeights smart action button") } else { Fail("crapeights smart action button") }
if ($eight -match 'id="passBtn"') { Pass("crapeights pass action button") } else { Fail("crapeights pass action button") }

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
if ($rummy -match 'let aiTurnTimeoutId = null;') { Pass("ai timeout state") } else { Fail("ai timeout state") }
if ($rummy -match 'function clearAiTurnTimeout\(\)') { Pass("ai timeout clear helper") } else { Fail("ai timeout clear helper") }
if ($rummy -match 'function queueAiTurn\(delayMs\)') { Pass("ai timeout queue helper") } else { Fail("ai timeout queue helper") }
if ($rummy -match '(?s)function resolveStockStall\([^)]*\)\s*\{\s*if \(state\.roundOver\) return;\s*clearAiTurnTimeout\(\);') { Pass("stock stall clears ai timeout") } else { Fail("stock stall clears ai timeout") }
if ($rummy -match '(?s)function dealRound\(\)\s*\{\s*clearAiTurnTimeout\(\);') { Pass("deal round clears ai timeout") } else { Fail("deal round clears ai timeout") }
if ($rummy -match 'queueAiTurn\(650\);') { Pass("deal round queues ai turn") } else { Fail("deal round queues ai turn") }
if ($rummy -match 'queueAiTurn\(700\);') { Pass("player end turn queues ai turn") } else { Fail("player end turn queues ai turn") }
if ($rummy -match '(?s)function finishRound\([^)]*\)\s*\{\s*clearAiTurnTimeout\(\);') { Pass("finish round clears ai timeout") } else { Fail("finish round clears ai timeout") }
if ($rummy -match '(?s)function resetMatch\(\)\s*\{\s*clearAiTurnTimeout\(\);') { Pass("reset match clears ai timeout") } else { Fail("reset match clears ai timeout") }
if ($rummy -match 'const winner = state\.playerScore === state\.aiScore\s*\?\s*"Tie"\s*:\s*\(state\.playerScore > state\.aiScore \? "Player" : "AI"\);') { Pass("rummy match winner compares both scores") } else { Fail("rummy match winner compares both scores") }
if ($rummy -match 'Match tied at target\.') { Pass("rummy tie-at-target summary") } else { Fail("rummy tie-at-target summary") }
if ($rummy -match '(?s)function refillStockIfNeeded\(\)\s*\{\s*if \(state\.stock\.length > 0\) return true;\s*if \(state\.discard\.length <= 1\) return false;') { Pass("stock refill keeps top discard") } else { Fail("stock refill keeps top discard") }
if ($rummy -match 'resolveStockStall\(\"Stock exhausted\. Round ends in a draw\.\"\);') { Pass("stock exhaustion draw path present") } else { Fail("stock exhaustion draw path present") }

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
if ($spades -match 'const tiedAtOrAboveTarget = teamAReached && teamBReached && state\.scores\[0\] === state\.scores\[1\];') { Pass("spades tie-break detection") } else { Fail("spades tie-break detection") }
if ($spades -match "Scores tied above target\. Play a tiebreaker round\.") { Pass("spades tie-break status text") } else { Fail("spades tie-break status text") }
if ($spades -match 'state\.bidTurn = \(state\.bidTurn \+ 1\) % 4;') { Pass("spades bid turn advance not hardcoded") } else { Fail("spades bid turn advance not hardcoded") }
if ($spades -match 'const nextMode = state\.phase === ''roundEnd'';') { Pass("spades next-round gate") } else { Fail("spades next-round gate") }
if ($spades -match 'el\.nextRoundTop\.addEventListener\(''click'', \(\) => \{ if \(state\.phase === ''roundEnd''\) startRound\(\); \}\);') { Pass("spades tiebreak round action") } else { Fail("spades tiebreak round action") }

Write-Host "`n=== Summary ===" -ForegroundColor Cyan
Write-Host "Passed: $passed" -ForegroundColor Green
Write-Host "Failed: $failed" -ForegroundColor $(if ($failed -gt 0) { "Red" } else { "Green" })
exit $failed
