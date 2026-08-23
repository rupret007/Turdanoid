# Stale Remote Branches (August 2026)

This file documents remote branches that can be deleted. They are left over from
closed PRs or abandoned experiments.

## Already-Merged (safe to delete now)

- `cursor/turdanoid-improvement-roadmap-fc2b` — PR #6 merged July 2026

## From Closed PRs (verify nothing needed, then delete)

- `codex/improve-existing-functionality` — PR #2 (keyboard controls), superseded by PR #6
- `cursor/find-chicken-sandwiches-app-f1a7` — PR #4 (off-topic, wrong repo)
- `cursor/system-stability-and-usability-7e20` — PR #5 (stability), superseded by PR #6

## Orphan Branches (no PR, likely abandoned)

- `cursor/debug-and-improve-turdtris-game-5474`
- `cursor/develop-updated-arkanoid-with-adult-themes-5f75`
- `cursor/iphone-blackjack-experience-a3f1`
- `cursor/iphone-blackjack-experience-baad`
- `cursor/iphone-blackjack-game-3048`

## How to Delete

```bash
git push origin --delete <branch-name>
```

Or use the GitHub UI: Settings > Branches > delete stale branches.

---
*Generated during stale-PR hygiene pass, August 2026.*
