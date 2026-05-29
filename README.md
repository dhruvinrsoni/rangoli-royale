# Rangoli Royale

> Draw the line. Hold the grid.

A two-team strategy game on a South Asian rangoli/kolam dot grid. Pass the device. Take turns. Block your rival.

**Live:** https://dhruvinrsoni.github.io/rangoli-royale/

---

## What it is

A grid of dots in two alternating colors. Players sit in a circle in alternating team order and pass one device around. Each turn, the active player draws **one** straight line between two same-color dots of their team — horizontal or vertical. The geometry creates strategic blocking: a horizontal line of one color cuts through where the other team might have wanted a vertical line.

Two win modes ship in v1, selectable at setup:

- **Longest single line** — longest unbroken straight chain of your team's edges.
- **Largest connected tree** — largest connected subgraph of dots joined by your team's edges.

The game ends when neither team has a legal move, or when every legal edge is claimed.

---

## Why a PWA

- One device, pass it around — works exactly like the paper version.
- Install on phone, play offline at a wedding / pooja / car ride / Diwali party.
- Zero account, zero login, zero telemetry — every game stays on the device.
- All settings, in-progress games, and history live in `localStorage`.

---

## Run locally

No build step. Pick whichever server you have handy:

```bash
# 1. npm script (uses Python under the hood — Python ships with most dev setups)
npm run dev
# → http://localhost:8765

# 2. or Node-based static server (downloads `serve` via npx on first run)
npm run dev:node

# 3. or run Python directly without npm
python -m http.server 8765
```

Then in another tab, open the engine tests at http://localhost:8765/tests.html to verify the pure engine on your machine.

Opening `index.html` directly in a browser also works for quick checks, but service worker registration is skipped on `file://`.

---

## Game engine tests

Open [tests.html](tests.html) in a browser. All assertions log to the console.

---

## Tech

Vanilla HTML + CSS + JS. ES modules. SVG grid. CSS custom properties for theming. No bundler, no framework, no npm dependencies. Designed so the v1 engine is a pure deterministic state machine — v2 (online multiplayer via Vercel/Supabase) wraps it without rewrite.

| Area | Where |
|---|---|
| Pure game engine | `src/lib/{geometry,turn-engine,scoring}.js` |
| Storage abstraction | `src/lib/storage.js` |
| UI screens | `src/ui/{home,setup,game,endgame,settings,stats,howto}.js` |
| Feature flags | `src/config/features.js` |
| Add-ons (timer, undo, haptic, etc.) | `src/features/*/` |
| Rules text | [docs/rules.md](docs/rules.md) |
| Deployment | [docs/deployment.md](docs/deployment.md) |

---

## Deployment

Push to `main` → GitHub Actions builds and deploys to GitHub Pages. Health check pings the live URL every 6 hours. Versioned releases are cut via manual workflow dispatch on `create-tag-release.yml`.

See [docs/deployment.md](docs/deployment.md) for the full deploy / release / rollback flow.

---

## How to play

See [docs/rules.md](docs/rules.md) or tap **How to Play** from the home screen.

---

## License

[Apache-2.0](LICENSE) — Copyright © Dhruvin Rupesh Soni.
