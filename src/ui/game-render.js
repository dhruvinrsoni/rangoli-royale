import { claimedEdges, currentTeam } from '../lib/turn-engine.js';

const SVG_NS = 'http://www.w3.org/2000/svg';
const MARGIN = 24;
const DOT_RADIUS = 5;
const STROKE_WIDTH = 5;

const HIT_INSET_FRAC = 0.22;
const HIT_MAX_PERP_FRAC = 0.32;

function el(name, attrs = {}, children = []) {
  const node = document.createElementNS(SVG_NS, name);
  for (const [k, v] of Object.entries(attrs)) {
    if (v == null) continue;
    node.setAttribute(k, String(v));
  }
  for (const child of children) {
    node.appendChild(child);
  }
  return node;
}

function clientToSvg(svg, clientX, clientY) {
  const pt = svg.createSVGPoint();
  pt.x = clientX;
  pt.y = clientY;
  const ctm = svg.getScreenCTM();
  if (!ctm) return { x: clientX, y: clientY };
  return pt.matrixTransform(ctm.inverse());
}

function findClosestActiveEdge(px, py, grid, team, claimed) {
  if (!team) return null;
  const maxPerp = grid.spacing * HIT_MAX_PERP_FRAC;
  const tMin = HIT_INSET_FRAC;
  const tMax = 1 - HIT_INSET_FRAC;
  let best = null;
  for (const edge of grid.legalEdges) {
    if (edge.team !== team) continue;
    if (claimed.has(edge.id)) continue;
    const dx = edge.x2 - edge.x1;
    const dy = edge.y2 - edge.y1;
    const lenSq = dx * dx + dy * dy;
    if (lenSq === 0) continue;
    const t = ((px - edge.x1) * dx + (py - edge.y1) * dy) / lenSq;
    if (t < tMin || t > tMax) continue;
    const cx = edge.x1 + t * dx;
    const cy = edge.y1 + t * dy;
    const dist = Math.hypot(px - cx, py - cy);
    if (dist > maxPerp) continue;
    if (!best || dist < best.dist) best = { id: edge.id, dist };
  }
  return best;
}

export function renderGridSvg(state, grid, opts = {}) {
  const { canInteract = true } = opts;
  const teams = state.setup.teams;
  const claimed = claimedEdges(state);
  const activeTeam = currentTeam(state, grid);
  const interactiveTeam = canInteract ? activeTeam : null;

  const b = grid.bounds || {
    minX: 0, minY: 0,
    maxX: (grid.cols - 1) * grid.spacing,
    maxY: (grid.rows - 1) * grid.spacing,
  };
  const width = (b.maxX - b.minX) + 2 * MARGIN;
  const height = (b.maxY - b.minY) + 2 * MARGIN;

  const svg = el('svg', {
    xmlns: SVG_NS,
    viewBox: `${b.minX - MARGIN} ${b.minY - MARGIN} ${width} ${height}`,
    'aria-label': 'Game grid',
    class: 'game-grid',
    role: 'img',
  });

  const ghostLayer = el('g', { class: 'edges-ghost' });
  const claimedLayer = el('g', { class: 'edges-claimed' });
  const dotsLayer = el('g', { class: 'dots' });

  for (const edge of grid.legalEdges) {
    const claim = claimed.get(edge.id);
    if (claim) {
      const color = teams[claim.team].color;
      claimedLayer.appendChild(el('line', {
        x1: edge.x1, y1: edge.y1, x2: edge.x2, y2: edge.y2,
        stroke: color,
        'stroke-width': STROKE_WIDTH,
        'stroke-linecap': 'round',
        class: `edge edge-${claim.team}`,
        'data-edge': edge.id,
        'data-anim': claim.moveIndex === state.moveLog.length - 1 ? 'just-claimed' : null,
      }));
    } else if (edge.team === activeTeam) {
      ghostLayer.appendChild(el('line', {
        x1: edge.x1, y1: edge.y1, x2: edge.x2, y2: edge.y2,
        stroke: teams[edge.team].color,
        'stroke-width': 2,
        'stroke-linecap': 'round',
        class: 'edge-ghost is-active',
        'data-edge': edge.id,
        opacity: 0.25,
      }));
    }
  }

  for (const dot of grid.dots) {
    dotsLayer.appendChild(el('circle', {
      cx: dot.x, cy: dot.y, r: DOT_RADIUS,
      fill: teams[dot.team].color,
      class: `dot dot-${dot.team}`,
      'data-dot': dot.id,
    }));
  }

  svg.appendChild(ghostLayer);
  svg.appendChild(claimedLayer);
  svg.appendChild(dotsLayer);

  if (interactiveTeam) {
    svg.classList.add('is-playable');

    let hoveredEl = null;
    const setHovered = (newEl) => {
      if (hoveredEl === newEl) return;
      if (hoveredEl) hoveredEl.classList.remove('is-hovered');
      hoveredEl = newEl;
      if (hoveredEl) hoveredEl.classList.add('is-hovered');
    };

    svg.addEventListener('pointermove', (e) => {
      if (e.pointerType === 'touch') return;
      const { x, y } = clientToSvg(svg, e.clientX, e.clientY);
      const closest = findClosestActiveEdge(x, y, grid, interactiveTeam, claimed);
      if (!closest) { setHovered(null); return; }
      setHovered(ghostLayer.querySelector(`[data-edge="${closest.id}"]`));
    });
    svg.addEventListener('pointerleave', () => setHovered(null));

    svg.addEventListener('click', async (e) => {
      const { x, y } = clientToSvg(svg, e.clientX, e.clientY);
      const closest = findClosestActiveEdge(x, y, grid, interactiveTeam, claimed);
      if (!closest) return;
      const gameMod = await import('./game.js');
      gameMod._handleEdgeTap(closest.id);
    });
  }

  return svg;
}
