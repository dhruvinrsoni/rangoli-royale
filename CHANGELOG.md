# Changelog

All notable changes to **rangoli-royale** will be documented in this file.

Format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/) and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

## [0.3.0] — 2026-05-30

### Added — Admin dashboard
- **Hidden `/#admin` route** for the owner. Not linked from anywhere — bookmark or remember the URL.
- **PIN + HMAC-signed-cookie auth.** PBKDF2-SHA256 (120k iterations) hashed PIN stored as `ADMIN_PIN_HASH` env var; HMAC signing key as `ADMIN_COOKIE_SECRET`. 4-hour auto-expiry. Force-logout button.
- **Rate limit**: 5 failed PIN attempts per IP per hour → 429. Persisted in `admin_failed_logins` table.
- **Audit log**: every admin action (login, logout, delete-room, wipe, force-end, config change) recorded in `admin_audit` table. Recent 20 shown on dashboard.
- **Dashboard actions**:
  - Stats panel: rooms in use, breakdown by status, oldest room, failed logins last 24h.
  - Live rooms table: code, status pill, host name, players (in/cap), moves, board shape, age, TTL.
  - Per-room **Delete** (immediate) and **End** (force-end with `endReason: "Ended by admin"`, opponents see endgame).
  - **Nuke all rooms** in one click (confirmation required).
  - **MAX_ROOMS override**: stored in `admin_config` table, takes precedence over env var, in-memory cached for 30s. Clear override button to fall back to env.
  - Recent audit feed.
- **Helper script** `node scripts/hash-admin-pin.mjs` generates `ADMIN_PIN_HASH` and `ADMIN_COOKIE_SECRET` env-var values.

### Added — Admin endpoints
- `POST /api/admin/login` — verify PIN, set signed cookie
- `POST /api/admin/logout` — clear cookie + audit
- `GET  /api/admin/me` — check session validity
- `GET  /api/admin/rooms` — list active rooms (admin only)
- `DELETE /api/admin/rooms` — wipe all (admin only)
- `DELETE /api/admin/room/<code>` — delete one (admin only)
- `POST /api/admin/room/<code>` — force-end one (admin only)
- `GET  /api/admin/stats` — stats + audit feed (admin only)
- `POST /api/admin/config` — set MAX_ROOMS override (admin only)
- `DELETE /api/admin/config?key=maxRooms` — clear override (admin only)

### Security properties
- Cookie: `HttpOnly`, `Secure`, `SameSite=Strict`, signed HMAC-SHA256, 4h expiry
- PIN never leaves browser; server only stores PBKDF2 hash
- Constant-time comparison on PIN and cookie verification
- Rate limit on login endpoint
- Every authenticated action logged with IP + timestamp
- `MAX_ROOMS` override clamped to [1, 500] server-side
- No admin UI elements shown if backend reports `NO_CONFIG` (missing env vars)

### Changed
- `getMaxRooms()` is now async and reads optional DB override (30s in-memory cache)
- Cache → v19; version → 0.3.0

## [0.2.4] — 2026-05-30

### Added
- **Reload button on screen-load errors** — when a route fails to load, the user sees a clear Reload + Home action pair instead of a dead text message. Feels like an app, not a broken webpage.

### Fixed
- **Hover effects only show for the player whose turn it is.** Previously, both players saw edge-glow on hover even when it wasn't their turn. Now only the active player sees the playable cursor and edge-glow; the waiting player sees a static, read-only board.

## [0.2.3] — 2026-05-30

### Fixed
- **Sub-second online latency.** Switched from interval-polling to **HTTP long-polling**. Server holds the GET request for up to 7s, returns the moment state changes. Worst-case lag is now ~700ms (server's inner poll interval), average ~350ms.
- **Background tab uses 30s polling** instead of full long-polling — tab-throttling on most browsers would block long-polls anyway. When the tab becomes visible again, an immediate refresh is triggered.

### Added
- **Edge hover glow + cursor pointer** — when a mouse hovers near a legal edge, that edge brightens with a soft glow. Cursor switches to pointer on the board when it's your turn.
- **Subtle board tint by current team** — the game board's border and shadow take on the active team's color (~35% tint). Quiet visual feedback for who's up.
- **Give Up button** — explicit forfeit. Confirm → game ends with `endReason: "<name> gave up"` → endgame screen with current scores intact. Works local and online.
- **Skipped-turn announcement** — when a team has no legal moves and the engine skips them, the banner shows "Opponent had no moves — plays again" and a 2-second toast fires on first occurrence per skip.
- **Auto-play when only one legal move remains** — board pulses the single option for 1 second, then the engine plays it automatically. Saves a mechanical tap; player can still tap manually within the second.

### Backend
- `GET /api/<code>?wait=1&since=<key>` long-poll mode. Inner DB poll every 700ms, 7s budget.
- `POST /api/<code>/give-up` — forfeits the game with reason.
- `computeStateKey` shared between server and client to avoid drift.

### Changed
- Cache → v17

## [0.2.2] — 2026-05-29

### Fixed
- **SVG pulsing on every poll.** `pollOnce` now hashes the state into a short key and only notifies subscribers when the key changes. Identical state arriving from polls no longer triggers a destroy+rebuild of the grid.

### Added — Lifecycle
- **Leaving mid-game ends the game.** Server-side `leaveRoom` sets `status='ended'`, records `endReason: "X left the room"`. Both players land on the endgame screen with the reason shown.
- **Host transfer in lobby.** If the host leaves while in lobby, `hostSeat` shifts to the next remaining player. The new host can start when ≥2 players are present.
- **Endgame screen reads online state directly** when in a room (gets `endReason`, fresh `moveLog`).
- **Leave room button on endgame** for online games.

### Changed — Polling
- **Adaptive poll intervals** based on who's-up:
  - Opponent's turn → 1.5s (down from 2s) — fastest worst-case lag
  - Lobby → 2s (same)
  - Your turn → 5s — no need to poll fast while you're thinking
  - Ended → 8s — almost idle
- `endReason` is part of the state-key hash so "opponent left" propagates immediately.
- Cache → v16

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
