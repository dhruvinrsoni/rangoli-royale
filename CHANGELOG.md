# Changelog

All notable changes to **rangoli-royale** will be documented in this file.

Format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/) and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

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
