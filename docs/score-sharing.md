# Completed-score sharing

Turdtris and Turdomania offer Share score and Save image on completed results.
The shared utility prepares a branded PNG before the click, calls native sharing
within the original gesture, and falls back to clipboard or selectable text.
Cancellation never copies a score. New runs and Undo invalidate pending images
and asynchronous status updates. Result snapshots retain actual mode/difficulty,
Sprint completion/time, score and game URL without old seed/daily/query data.

No records, save keys, game rules, audio or Daily Dump behavior change. Sharing
keyboard events stay inside the controls; ordinary game-over replay remains.
Short-phone result panels scroll internally to keep all actions reachable.
The phone result sheet escapes the playfield's isolated stacking layer so the
normal HUD cannot cover completed stats. Share feedback scrolls into view.
Browser and native-share API fallbacks are covered; actual OS share-sheet behavior
still needs physical-device testing. Validation receipts live in the parent
workspace's release-evidence/sharing-discovery directory.
