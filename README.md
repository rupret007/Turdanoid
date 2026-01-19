# Blackjack (iPhone-first) + Extras

This repo now includes a **mobile-first Blackjack game** designed to feel great on an iPhone (large touch targets, safe-area support, clean game flow), plus the original Arkanoid variant.

## Play

- **Blackjack**: open `index.html`
- **Neon Arkanoid**: open `arkanoid.html`

## Blackjack rules & features

- **Payout**: Blackjack pays **3:2**
- **Shoe**: configurable **1–8 decks**
- **Dealer rule**: toggle **H17** (hit soft 17) / **S17**
- **Actions**: Hit / Stand / Double / Split (exact pairs) / Insurance (vs Ace)
- **Split Aces**: one card each (auto-stand)
- **Persistence**: bankroll, settings, and stats saved to `localStorage`

## Development

No build step. Just open the HTML files in a browser.