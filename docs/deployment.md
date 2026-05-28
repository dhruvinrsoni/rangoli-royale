# Deployment — Rangoli Royale

Live URL: **https://dhruvinrsoni.github.io/rangoli-royale/**

GitHub Pages, deployed via Actions. Push `main` → live in ~2 minutes.

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
