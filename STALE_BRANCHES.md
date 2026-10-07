# Stale Remote Branches

Checked against origin on 7 Oct 2026. Left over from closed PRs or abandoned experiments. This file is a note, not a delete command.

## Already gone from origin

- `cursor/turdanoid-improvement-roadmap-fc2b` — PR #6 merged July 2026
- `codex/improve-existing-functionality` — PR #2 (keyboard controls), superseded by PR #6
- `cursor/find-chicken-sandwiches-app-f1a7` — PR #4 (off-topic, wrong repo)
- `cursor/system-stability-and-usability-7e20` — PR #5 (stability), superseded by PR #6

## Still on origin (orphans, no open PR)

- `cursor/debug-and-improve-turdtris-game-5474`
- `cursor/develop-updated-arkanoid-with-adult-themes-5f75`
- `cursor/iphone-blackjack-experience-a3f1`
- `cursor/iphone-blackjack-experience-baad`
- `cursor/iphone-blackjack-game-3048`

Active 1000x lane branches (`cursor/turdanoid-1000x-*`) and `main` are not stale.

## How to Delete (operator, later)

```bash
git push origin --delete <branch-name>
```

Or GitHub: Settings → Branches → delete.
