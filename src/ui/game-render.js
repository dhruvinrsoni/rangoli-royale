import { claimedEdges, currentTeam } from '../lib/turn-engine.js';

const SVG_NS = 'http://www.w3.org/2000/svg';
const MARGIN = 24;
const DOT_RADIUS = 5;
const HIT_RADIUS = 18;
const STROKE_WIDTH = 5;

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

export function renderGridSvg(state, grid) {
  const teams = state.setup.teams;
  const claimed = claimedEdges(state);
  const activeTeam = currentTeam(state, grid);

  const width = (grid.cols - 1) * grid.spacing + 2 * MARGIN;
  const height = (grid.rows - 1) * grid.spacing + 2 * MARGIN;

  const svg = el('svg', {
    xmlns: SVG_NS,
    viewBox: `${-MARGIN} ${-MARGIN} ${width} ${height}`,
    'aria-label': 'Game grid',
    class: 'game-grid',
    role: 'img',
  });

  const claimedLayer = el('g', { class: 'edges-claimed' });
  const hitLayer = el('g', { class: 'edges-hit' });
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
    } else {
      const isActive = edge.team === activeTeam;
      const hit = el('line', {
        x1: edge.x1, y1: edge.y1, x2: edge.x2, y2: edge.y2,
        stroke: 'transparent',
        'stroke-width': HIT_RADIUS * 2,
        'stroke-linecap': 'round',
        class: `edge-hit ${isActive ? 'is-active' : 'is-inactive'}`,
        'data-edge': edge.id,
        'data-team': edge.team,
      });
      hitLayer.appendChild(hit);

      const ghost = el('line', {
        x1: edge.x1, y1: edge.y1, x2: edge.x2, y2: edge.y2,
        stroke: teams[edge.team].color,
        'stroke-width': 2,
        'stroke-linecap': 'round',
        class: `edge-ghost ${isActive ? 'is-active' : ''}`,
        'data-edge': edge.id,
        opacity: isActive ? 0.18 : 0.05,
      });
      hitLayer.insertBefore(ghost, hit);
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

  svg.appendChild(hitLayer);
  svg.appendChild(claimedLayer);
  svg.appendChild(dotsLayer);

  svg.addEventListener('pointerdown', async (e) => {
    const hit = e.target.closest('.edge-hit');
    if (!hit) return;
    e.preventDefault();
    const edgeId = hit.dataset.edge;
    const gameMod = await import('./game.js');
    gameMod._handleEdgeTap(edgeId);
  });

  return svg;
}
