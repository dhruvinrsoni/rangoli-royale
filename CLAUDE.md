# CLAUDE.md — rangoli-royale

Project-specific instructions for Claude Code. Auto-loaded when working in this repo.

---

## Project

A 2-team strategy game on a South Asian rangoli/kolam dot grid. v1 ships to GitHub Pages as a zero-build vanilla PWA. v2 (online multiplayer via Vercel/Supabase) is designed-for but not built — the v1 engine is a pure deterministic state machine so v2 wraps it without rewrite.

**Stack:** HTML · CSS · Vanilla JS (ES modules) · SVG · PWA
**Data stance:** All data stays on device. Zero telemetry. localStorage only.

---

## Critical File Map

| What | Where |
|---|---|
| App entry / router | `src/main.js` |
| Game engine (pure) | `src/lib/geometry.js`, `src/lib/turn-engine.js`, `src/lib/scoring.js` |
| Storage abstraction | `src/lib/storage.js` (v2 will swap for Supabase) |
| Event bus | `src/lib/events.js` |
| Feature flags | `src/config/features.js` |
| Difficulty presets | `src/config/difficulty.js` |
| UI screens | `src/ui/{home,setup,game,endgame,settings,stats,howto}.js` |
| Per-screen styles | `src/styles/<screen>.css` (1:1 with each `ui/*.js`) |
| Design tokens | `src/styles/base.css`, `src/styles/themes.css` |
| Add-ons (flag-gated) | `src/features/{team-names,undo-move,turn-timer,sound-fx,haptic}/` |
| Browser engine tests | `tests.html` |
| Service worker | `sw.js` (bump `CACHE_NAME` on asset changes) |
| Roadmap | `C:\Users\DS3741\.claude\plans\we-need-to-continue-glistening-ladybug.md` (resumable per-phase status) |

---

## Common Commands

| Command | Purpose |
|---|---|
| `npm run dev` | Serve locally (Python under the hood); visit `http://localhost:8765` |
| `npm run dev:node` | Alternative Node-based server (uses `npx serve`) |
| Open `http://localhost:8765/tests.html` | Run engine tests; assertions on the page |
| `git push origin main` | Triggers deploy-pages.yml → GitHub Pages |
| `gh workflow run create-tag-release.yml -f version=X.Y.Z` | Cut a tagged release |
| `gh workflow run rollback.yml -f target=<sha>` | Roll deployment back |

---

## Domain Skills

Load `.github/skills/<name>/SKILL.md` on demand:

| Skill | Load when... |
|---|---|
| `pwa-optimization` | Service worker strategy, cache versioning, Lighthouse PWA debugging |
| `repo-maintenance` | Cleanup, dead code audit, file reorg |
| `systematic-debugging` | Reproduce → bisect → fix on a tricky bug |

---

## Key Conventions

- **Mobile-first.** Min 44px touch targets. Single column at phone width, tablet may widen the grid.
- **No build step.** ES modules only, served as-is. No bundler, no npm dependencies.
- **No code comments.** Naming carries intent. Only comment when *why* is non-obvious (a workaround for a specific bug, a hidden invariant).
- **Relative paths everywhere.** Site is served at `/rangoli-royale/` on GH Pages — absolute paths break. `start_url: "."`, `scope: "."`, `./index.html` in `sw.js` ASSETS_TO_CACHE.
- **1:1 JS/CSS pairing.** Every `src/ui/<screen>.js` has a matching `src/styles/<screen>.css`.
- **Feature flags are render-time.** `src/config/features.js` is read at module import. Don't gate UI only at runtime — dead code shouldn't ship.
- **Engine must be deterministic.** `applyMove(state, move)` is pure. No `Date.now()`, no `Math.random()` inside the engine (seat-randomization happens once at setup and is stored). Replays must be byte-identical — v2 depends on this.
- **Storage keys are namespaced** under `rangoli-royale:*`.
- **Commits:** `feat:`, `fix:`, `docs:`, `chore:`, `refactor:`, `test:`, `style:` prefixes. Atomic — one logical change per commit.

---

## Game Mechanics (quick reference)

- Dots in a rectangular grid, alternating column colors (team A / team B), every other row offset by half a step (zigzag).
- A turn = one straight line between two same-color dots of your team (horizontal or vertical, adjacent in the same-color sub-grid).
- A horizontal line geometrically crosses a perpendicular vertical line of the opponent → blocking mechanic.
- Win modes: `longest-line` (longest unbroken straight chain) or `largest-tree` (largest connected subgraph by node count). Chosen at setup.
- Game ends when both teams have zero legal moves, or all edges claimed.

---

## Deployment

GitHub Pages via Actions. Push `main` → deploy-pages.yml. Health check every 6h via deployment-status.yml. Manual versioned releases via create-tag-release.yml. Rollback via rollback.yml. See `docs/deployment.md`.

---

## Workflow

### Bug Fix
1. Reproduce in browser → find root cause → fix
2. Re-run `tests.html` if engine-related
3. `git commit -m "fix: <description>"`

### New Feature
1. Load relevant domain skill if applicable → implement
2. Wire feature flag if user-facing optional behavior
3. `git commit -m "feat(scope): <description>"`

### Cache busting
When you change any asset under `src/`, `css/`, `js/`, `assets/`, bump `CACHE_NAME` in `sw.js` from `rangoli-royale-vN` → `rangoli-royale-v(N+1)` and update `ASSETS_TO_CACHE` if files were added/removed.
