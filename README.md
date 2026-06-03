# Rangoli Royale

> Draw the line. Hold the grid.

A two-team strategy game on an Indian rangoli/kolam dot grid. Play online with friends, or pass the device.

**▶ Play online (multiplayer):** https://rangoli-royale.vercel.app/
**Offline build (GitHub Pages):** https://dhruvinrsoni.github.io/rangoli-royale/

---

## What it is

Each player draws **one** straight line per turn between two same-color dots of their team. The geometry creates blocking — a horizontal line of one color cuts through where the other team might have wanted a vertical line.

Two win modes (chosen at setup):

- **Longest single line** — longest unbroken straight chain in your team's graph.
- **Largest connected tree** — largest connected subgraph of dots.

Game ends when neither team can move.

---

## Two flavours, same engine

| | GitHub Pages | Vercel |
|---|---|---|
| URL | `dhruvinrsoni.github.io/rangoli-royale/` | `rangoli-royale.vercel.app/` |
| Mode | Offline-only, pass-the-device | Adds online rooms (8-digit numeric codes) |
| Backend | none | Vercel functions + Neon Postgres |
| Sync | n/a | HTTP long-polling, sub-second lag |
| Admin dashboard | n/a | `/#sutradhara` (PIN-gated) |

If Vercel ever breaks, GitHub Pages still works.

---

## Run locally

No build step.

```bash
npm run dev               # python -m http.server 8765
# or
npm run dev:node          # npx serve

open http://localhost:8765/
open http://localhost:8765/tests.html   # engine assertions
```

ES modules + SVG + CSS. Zero npm deps for the game itself; `@neondatabase/serverless` only used by the Vercel functions.

---

## Architecture

| Area | Path |
|---|---|
| Pure game engine | `src/lib/{geometry,turn-engine,scoring}.js` |
| Local storage | `src/lib/storage.js` |
| Online session | `src/lib/online-session.js` (long-poll loop, persisted to localStorage) |
| UI screens | `src/ui/{home,setup,game,endgame,settings,stats,howto,room-create,room-join,lobby,admin}.js` |
| Vercel functions | `api/health.js`, `api/create.js`, `api/[code].js`, `api/[code]/{join,start,move,leave,give-up}.js`, `api/admin/[...path].js` |
| Admin auth helpers | `api/_lib/admin-auth.js` (PBKDF2 + HMAC, zero npm deps) |
| Rules text | `docs/rules.md` |
| Deployment | `docs/deployment.md` |

---

## Online multiplayer (Vercel build)

- Create a room → 8-digit numeric code → share it
- Friends paste the code → enter a name → join
- Host taps Start → game flows like local, but each move syncs over HTTP long-poll
- **Cap**: configurable concurrent rooms (default 10) via `MAX_ROOMS` env var or admin dashboard override
- **Lifecycle**: rooms auto-expire after 30 min of idleness (5 min after game ends); no cron job
- **Auto-fallback**: if the backend is unreachable, online buttons hide and game still runs locally

---

## Admin (Sūtradhāra)

Hidden route `/#sutradhara`. To reach it without typing the URL: **tap the home title 7 times within 3 seconds**.

### One-time setup

```bash
node scripts/hash-admin-pin.mjs
```

Type a BEEJA prefix (or press Enter to skip) and your PIN. Script prints env-var values. Paste into Vercel → Settings → Environment Variables:

```
ADMIN_PIN_HASH=...
ADMIN_COOKIE_SECRET=...
BEEJA=...                  (optional secret prefix)
ADMIN_PIN_MODE=hour        (optional: static / day / hour)
MAX_ROOMS=10               (optional: concurrent room cap)
```

Redeploy. Visit `#sutradhara`, log in.

### Local self-test

```bash
node scripts/test-admin-pin.mjs
```

Tells you whether the PIN you're about to type would pass — without burning rate-limit attempts on the live server.

### What admin can do
- View live rooms (code, status, players, age, TTL)
- Delete or force-end any room
- Wipe all rooms
- Override `MAX_ROOMS` from the dashboard
- View server stats + recent admin actions

### Security
- PBKDF2-SHA256 hashed PIN (120k iterations), HMAC-signed `HttpOnly Secure SameSite=Strict` cookie, 4-hour auto-expiry
- Rate limit: 15 failed logins per IP per hour → 429
- Every admin action audited with IP + timestamp
- Optional hour-rotating PIN suffix (`DDHH` in IST) so shoulder-surfed PINs expire ~1h later

---

## Deployment

Push to `main`:
- GitHub Pages auto-builds & deploys (offline-only build)
- Vercel auto-builds & deploys (online-enabled build, same source)

See `docs/deployment.md` for the full deploy / release / rollback flow.

---

## License

[Apache-2.0](LICENSE) — Copyright © Dhruvin Rupesh Soni.
