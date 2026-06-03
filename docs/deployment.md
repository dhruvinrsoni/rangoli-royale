# Deployment — Rangoli Royale

Two parallel deployments, one source of truth on `main`:

- **Vercel** (primary — online-enabled build, backend + admin): https://rangoli-royale.vercel.app/
- **GitHub Pages** (offline-only build): https://dhruvinrsoni.github.io/rangoli-royale/

Push to `main` → both auto-deploy.

---

## Workflows

| Workflow | Trigger | What it does |
|---|---|---|
| [.github/workflows/deploy-pages.yml](../.github/workflows/deploy-pages.yml) | push to `main` (ignoring `**.md` + workflow files), `workflow_dispatch` | Validates required files (index.html, manifest.json, sw.js), uploads repo root as Pages artifact, deploys via `actions/deploy-pages@v4`. |
| [.github/workflows/deployment-status.yml](../.github/workflows/deployment-status.yml) | every 6 hours (cron), after each deploy, `workflow_dispatch` | curls the live URL, fails if HTTP ≠ 200. Output goes to job summary. |
| [.github/workflows/create-tag-release.yml](../.github/workflows/create-tag-release.yml) | `workflow_dispatch` (manual) | Cuts a versioned release: bumps `version.txt`, generates changelog from `git log`, creates tag + GitHub Release, optionally re-runs deploy-pages. |
| [.github/workflows/rollback.yml](../.github/workflows/rollback.yml) | `workflow_dispatch` (manual) | Rolls deployment back to a previous tag or commit SHA. `soft` strategy preserves `.github/workflows/`, `hard` resets everything. |
| [.github/workflows/security.yml](../.github/workflows/security.yml) | push, PR, weekly cron | Secret scanning + dependency audit. |
| [.github/workflows/label-sync.yml](../.github/workflows/label-sync.yml) | change to `.github/labels.yml`, manual | Syncs repo labels from declarative config. |

---

## First-time enablement

GitHub Pages → Source: **GitHub Actions** (not "Deploy from branch"). One-time setup in repo Settings → Pages. After that, every push to `main` (touching anything other than docs/workflows) auto-deploys.

---

## Day-to-day flow

```bash
# work
git checkout main
# … edit code …
git add <files>
git commit -m "feat(scope): description"
git push origin main
# → deploy-pages.yml runs (≈2 min)
# → deployment-status.yml runs after, verifies HTTP 200
```

Watch progress in the [Actions tab](https://github.com/dhruvinrsoni/rangoli-royale/actions).

---

## Cutting a release

```bash
gh workflow run create-tag-release.yml -f version=0.1.0 -f release_notes="First playable build"
```

Or trigger via GitHub UI → Actions → "Create Tag & Release" → Run workflow.

This will:

1. Validate semver format (e.g. `0.1.0`, not `v0.1.0`)
2. Update `version.txt` with `vX.Y.Z · <IST timestamp> · <release_notes>`
3. Commit the version bump
4. Create git tag `vX.Y.Z`
5. Generate changelog entries from `git log` since last tag
6. Create a GitHub Release with the changelog
7. Optionally re-deploy

---

## Rolling back

```bash
gh workflow run rollback.yml -f target=v0.1.0 -f strategy=soft
# or
gh workflow run rollback.yml -f target=<commit-sha> -f strategy=soft
```

- `soft`: checks out the target, **preserves** current `.github/workflows/`, re-deploys. Safer.
- `hard`: full `git reset --hard <target>`, re-deploys. Use only if workflows themselves are broken.

The rollback re-deploys to Pages from the rolled-back tree, so the live site reverts within ~2 minutes.

---

## Cache-bust ritual (PWA gotcha)

Service workers are sticky. If you ship a code change but users see stale content, the SW didn't pick up the new assets.

**Whenever you change** anything under `css/`, `js/`, `src/`, `assets/`, `index.html`, or `manifest.json`:

1. Open [sw.js](../sw.js)
2. Bump `CACHE_NAME` from `rangoli-royale-vN` → `rangoli-royale-v(N+1)`
3. Add/remove entries in `ASSETS_TO_CACHE` if files were added/removed
4. Commit

On the next deploy, the old cache is invalidated and clients fetch fresh.

---

## GitHub Pages subpath traps

The site lives at `/rangoli-royale/`, **not** at the root. Stick to:

- Relative URLs in HTML: `href="css/style.css"`, not `/css/style.css`
- `manifest.json`: `"start_url": "."`, `"scope": "."`
- `sw.js`: `'./index.html'`, not `'/index.html'`

If you see 404s on assets in production but they work locally, you almost certainly hit an absolute path.

---

## Health check

[deployment-status.yml](../.github/workflows/deployment-status.yml) pings the live URL every 6 hours. If it returns non-200, the workflow fails and shows up in the Actions tab. You can also trigger it manually:

```bash
gh workflow run deployment-status.yml
# or with a custom URL:
gh workflow run deployment-status.yml -f url=https://example.com/preview/
```

---

## Branch hygiene

`main` is the only deploy-tracked branch. The repo was bootstrapped from `Dhruvinrsoni/project-templates` via "Use this template" — if any stray `master` branch lingers on the remote, delete it via:

```bash
gh api -X DELETE repos/dhruvinrsoni/rangoli-royale/git/refs/heads/master
```

(or via the GitHub UI: Branches → trash icon).

---

## Vercel deployment (online build)

The Vercel deployment runs the same client source plus the `api/` serverless functions and a Neon Postgres database.

### One-time setup

1. **Vercel project** linked to this GitHub repo. Framework preset: **Other**. No build command.
2. **Storage → Create database → Neon (free tier)**. Connect to project. Auto-injects `DATABASE_URL` and related env vars.
3. **Env vars** (Project Settings → Environment Variables):

```
DATABASE_URL          # auto-injected by Neon integration
MAX_ROOMS=10          # concurrent online room cap (1–500)
ADMIN_PIN_HASH=…      # generated by scripts/hash-admin-pin.mjs
ADMIN_COOKIE_SECRET=… # generated by scripts/hash-admin-pin.mjs
BEEJA=…               # optional secret prefix mixed into PIN hash
ADMIN_PIN_MODE=hour   # optional: static / day / hour
```

Save → Vercel auto-redeploys.

### Day-to-day flow

Same as Pages: push to `main`. Vercel rebuilds and redeploys in ~30 seconds.

### Vercel Hobby tier limits to know about

| Limit | Ceiling | Our usage |
|---|---|---|
| Serverless functions per deployment | **12** | 9 (game + admin) |
| Function invocations | 100k/month | Long-poll keeps it under ~30k/month for active play |
| Function compute | 100 GB-hours/month | < 1 GB-hour for typical play |
| Function timeout | 10s | Long-poll holds for max 7s |
| Postgres storage | 256MB (Neon free) | < 10MB for all rooms ever |

If function-count goes near 12, consolidate routes into catch-all `[...path].js` (we already did this for admin).

### Reading logs

- Vercel project → **Logs** sidebar → search for `[admin/login]` or `[admin] dispatch` for the verbose login diagnostics
- Runtime Log view shows request lines only (status, duration); console.log output appears in the same Logs feed but as separate lines

### Lifecycle of online rooms

| Event | TTL behavior |
|---|---|
| Room created (lobby) | 30 min from creation |
| Any move | TTL extended to now + 30 min |
| Game ends | TTL truncated to now + 5 min (so all clients see the ending) |
| Player leaves mid-game | Game forced to `ended`, TTL → 5 min |
| Idle past TTL | Next `/api/*` request opportunistically `DELETE`s expired rooms |

Zero cron jobs. The DB self-cleans on every request.

### Sūtradhāra admin dashboard

Hidden route: `/#sutradhara`. To reach it without typing: **tap the home title 7 times within 3 seconds**.

Setup:

```bash
node scripts/hash-admin-pin.mjs    # generates PIN hash + cookie secret + BEEJA prompt
node scripts/test-admin-pin.mjs    # local self-test before retrying live
```

Capabilities:
- View live rooms (code, status, players, age, TTL)
- Delete or force-end any room
- Wipe all rooms
- Override `MAX_ROOMS` via DB (takes precedence over env var, 30s cache)
- View server stats + recent audit log

Auth model:
- **PBKDF2-SHA256 hashed PIN** (120k iterations, salted, with optional BEEJA prefix mixed in)
- **HMAC-SHA256 signed cookie** (HttpOnly, Secure, SameSite=Strict, 4-hour auto-expiry)
- **Rate limit**: 15 failed logins per IP per hour → 429
- **Audit log**: every admin action (login, logout, delete, wipe, force-end, config change) → `admin_audit` table
- **Optional rotating PIN**: `ADMIN_PIN_MODE=hour` requires you to append `DDHH` (today's day + IST hour) to your PIN at login

### Vercel fallback

If Vercel ever goes down or quota hits, the GitHub Pages build remains fully playable. Online buttons hide automatically when `/api/health` fails. No outage UX, just degraded mode.

---

## Cache-bust ritual recap

Same as GitHub Pages: bump `CACHE_NAME` in [sw.js](../sw.js) whenever you touch any cached asset under `src/`, `assets/`, `index.html`, or `manifest.json`. Service worker bypasses the cache for `/api/*` routes automatically.
