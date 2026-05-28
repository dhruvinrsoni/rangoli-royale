# CLAUDE.md — rangoli-royale Project Context

Project-specific instructions for Claude Code. Loaded automatically when working in this repo.

---

## Project

A 2-team strategy game on a rangoli dot grid
**Stack:** HTML · CSS · Vanilla JavaScript · PWA
**All data stays on device.** Zero telemetry.

---

## Critical File Map

Navigate here first — don't broad-search when the location is known:

| What | Where |
|------|-------|
| Entry point | `src/` |

---

## Common Commands

| Command | Purpose | Speed |
|---------|---------|-------|
| (fill in) | (fill in) | (fill in) |

---

## Domain Skills (On-Demand Context)

Load `.github/skills/<name>/SKILL.md` for deep domain knowledge:

| Skill | Load when... |
|-------|-------------|
| `repo-maintenance` | Cleanup, dead code audit, file reorganization |


---

## Efficiency Rules (Repo-Adapted)

### Model / Agent Selection

- **Direct (no agent):** Reading 1-2 known files, single targeted search, making code edits
- **Explore agent:** Understanding how a subsystem works, multi-file pattern discovery
- **Plan agent:** Before implementing non-trivial changes

### Discovery Strategy

Prefer in this order:
1. **Glob** for file finding
2. **Grep `files_with_matches`** to locate which files contain a symbol before reading
3. **Read** with `offset`+`limit` when the relevant region is known from Grep line numbers
4. **Explore agent** only when answer spans many files or requires iteration

### Parallelization

Run in parallel when independent:
- Multiple file reads (use one message with multiple Read calls)
- Multiple Grep/Glob searches
- Multiple Explore agents for different subsystems



---

## Key Conventions

- **Commit convention** — `fix:`, `feat:`, `docs:`, `chore:`, `refactor:`, `test:` prefixes
- **No hardcoded secrets** — use environment variables or `.env` (gitignored)


---

## Maintenance Workflows

Load `.github/skills/repo-maintenance/SKILL.md` for full cleanup framework.

### Bug Fix
```
1. Reproduce → find root cause → fix
2. echo "No build step — test manually"
3. git commit -m "fix: <description>"
```

### New Feature
```
1. Load relevant domain skill → plan → implement
2. echo "No build step — test manually"
3. git commit -m "feat: <description>"
```




---

## Vanilla PWA — Flavor-Specific Notes

### Architecture

Zero dependencies. Pure HTML/CSS/JS. Works on `file://` and `python -m http.server`.

### Service Worker

- Cache-first strategy with named versioned cache (`rangoli-royale-v1`)
- Bump cache version in `sw.js` when updating static assets
- Test offline: DevTools → Application → Service Workers → Offline checkbox

### PWA Checklist

- `manifest.json` — name, icons (192 + 512), theme_color, background_color, display: standalone
- `sw.js` — precache all CSS/JS/HTML files
- Icons in `assets/icons/` — 192x192 and 512x512 PNG (maskable recommended)

### Deployment

GitHub Pages via `deploy-pages.yml` on push to main. Health check runs every 6 hours.

### This Repo Specifically

- Every JS module has a 1:1 CSS counterpart (e.g., `notifications.js` / `notifications.css`)
- URL parameters supported for deep linking: `?key=value`
- Service Worker version must match `version.txt`
