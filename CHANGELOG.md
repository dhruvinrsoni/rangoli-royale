# Changelog

All notable changes to **rangoli-royale** will be documented in this file.

Format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/) and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

## [0.2.1] — 2026-05-29

### Fixed
- **Online session survives page reload** — code, clientId, seat, name, and last-known state are now persisted in `localStorage`. On reload, `restoreSessionSync()` re-creates the session and resumes polling. Host or joiner reloading no longer kicks anyone out.
- **Polling now emits on every state change, not just on new moves.** The previous `hasUpdate` flag only fired when `moveLog` grew, so player-joins and lobby→game transitions were silently dropped. Server `GET /api/<code>` now always returns full state; client always notifies subscribers.
- **Auto-resume on boot** — if you reload at `#home` with a persisted session, you land in `#lobby` / `#game` / `#endgame` depending on the room's status.
- **Game screen reads from live online session on mount**, not just stale `currentGame` storage.

### Added
- Remembered name across rooms (`rangoli-royale:online-name` in localStorage) — both Create and Join forms pre-fill it.
- **Manual `↻ Refresh`** button in lobby and game footer. Triggers an immediate poll on demand.
- `cache: 'no-store'` on every online API call so service workers and HTTP caches can't serve stale state.

### Changed
- Poll interval: 2s (active) / 5s (idle) — was 2.5s / 6s.
- Cache → v15

## [0.2.0] — 2026-05-29

### Added
- **Online multiplayer** — create a room, share an 8-character code, friends join from any device
- `api/` serverless functions: `health`, `create`, `[code]` (GET), `[code]/join`, `[code]/start`, `[code]/move`, `[code]/leave`
- Neon Postgres backing store (`rooms` table, JSONB state, indexed `expires_at` for cheap sweeps)
- Configurable concurrent-room cap via `MAX_ROOMS` env var (default 10) — set in Vercel dashboard, no code change needed to raise/lower
- 8-character base36 room codes (excludes confusing chars 0/O/1/I)
- Polling-based state sync (2.5s active, 6s idle) — no WebSocket infra
- `src/lib/online-session.js` — session manager with polling, optimistic state mirror, callback subscribers
- `src/config/online.js` — runtime backend detection via `/api/health` with 2.5s timeout, cached per session
- `src/ui/room-create.js`, `src/ui/room-join.js`, `src/ui/lobby.js` — new screens
- Home screen surfaces Create / Join cards only when backend is reachable

### Changed
- Service worker bypasses cache for `/api/*` requests (state must be fresh)
- `game.js` is online-aware: submits via server when in a room, polls for opponent moves, "Leave room" instead of "End game"
- Cache → v14

### Lifecycle (zero maintenance)
- Lobby rooms TTL: 30 min, refreshed on any activity
- In-progress games TTL: 30 min, refreshed on every move
- Ended games TTL: 5 min (so all clients see the result), then auto-deleted
- Each API call opportunistically sweeps expired rows — no cron job

### Dual deploy preserved
- **GitHub Pages** (`dhruvinrsoni.github.io/rangoli-royale/`) — pure offline, no backend, online buttons hidden when `/api/health` fails
- **Vercel** (`rangoli-royale.vercel.app`) — same code + backend, online buttons surface when health check succeeds

## [0.1.8] — 2026-05-29

### Changed
- `createGame` now requires explicit `startingTeam` ('A' or 'B') — Math.random() removed from engine. Engine is now provably pure: same setup + same move log → identical state on every client. This is the determinism contract v2 multiplayer depends on.
- `src/ui/setup.js` now picks the random starting team at form-submit time and passes it into `createGame`.

### Added
- `src/lib/sync-adapter.js` — pluggable session adapter seam. Local adapter is the default; online adapter (Vercel + Postgres) will slot in for v2 without touching UI code.

## [0.1.7] — 2026-05-29

### Added
- Settings → Preferences section with user-toggleable Haptic feedback and Sound effects
- Sound effects wired into game: move blip on each successful claim, low buzz on invalid taps
- `src/lib/preferences.js` — runtime preference store layered over build-time feature flags

### Changed
- `soundFx` feature flag flipped to `true` (code is shipping-ready; user defaults to OFF)

## [0.1.6] — 2026-05-29

### Added
- PWA PNG icons: 192/512 standard + 192/512 maskable + apple-touch-icon
- Manifest icons array now lists PNG and maskable variants for full installability
- `scripts/build-icons.py` — PIL-based icon renderer that mirrors the SVG design

### Changed
- OG/Twitter meta images now point to `icon-512.png`
- Apple touch icon link updated to PNG
- Service worker cache bumped to `rangoli-royale-v11`

## [0.1.5] — 2026-05-29

### Changed
- `longestLine` now computes the longest simple path through a team's graph in **dots** (was: longest straight run of edges). Line mode and tree mode now diverge strategically on branching shapes.
- Hexagon board shape uses a flat-top filter (`dx + dy * 0.6 <= half`) so top and bottom rows are non-empty and the silhouette reads clearly.

## [0.1.4] — earlier

### Added
- `dotsCovered` metric, defensive auto-end-detect, endgame "Save image" with shareable PNG card
- Four board shapes (rectangle, diamond, circle, hexagon) with symmetric A/B dot counts
- Tutorial overlay on first play

### Fixed
- Symmetric shape filter — both teams always have equal dot counts regardless of shape
- Geometric closest-edge detection for taps (replaces broken transparent-stroke SVG hit zones)

## [0.1.0] — initial

- Two-sub-grid staggered geometry
- Pure deterministic engine, longest-line + largest-tree scoring
- All v1 screens (home, setup, game, endgame, settings, stats, how-to-play)
- PWA shell with offline cache
- GitHub Pages deploy automation

---

<!-- Release entries are auto-generated below this line -->
