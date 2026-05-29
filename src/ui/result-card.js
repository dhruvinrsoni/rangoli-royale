import { claimedEdges } from '../lib/turn-engine.js';
import { longestLine, largestTree, dotsCovered } from '../lib/scoring.js';

const SVG_NS = 'http://www.w3.org/2000/svg';
const PAD = 24;
const CARD_W = 720;
const TITLE_H = 92;
const STATS_H = 220;
const FONT = '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';

function esc(s) {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function renderEdgesAndDots(state, grid) {
  const teams = state.setup.teams;
  const claimed = claimedEdges(state);
  let edges = '';
  for (const edge of grid.legalEdges) {
    const claim = claimed.get(edge.id);
    if (!claim) continue;
    edges += `<line x1="${edge.x1}" y1="${edge.y1}" x2="${edge.x2}" y2="${edge.y2}" stroke="${teams[claim.team].color}" stroke-width="5" stroke-linecap="round"/>`;
  }
  let dots = '';
  for (const dot of grid.dots) {
    dots += `<circle cx="${dot.x}" cy="${dot.y}" r="5" fill="${teams[dot.team].color}"/>`;
  }
  return edges + dots;
}

export function buildFinalGridSvg(state, grid) {
  const body = renderEdgesAndDots(state, grid);
  const b = grid.bounds;
  const w = (b.maxX - b.minX) + 2 * PAD;
  const h = (b.maxY - b.minY) + 2 * PAD;
  return `<svg xmlns="${SVG_NS}" viewBox="${b.minX - PAD} ${b.minY - PAD} ${w} ${h}" class="final-grid" role="img" aria-label="Final game board">${body}</svg>`;
}

export function buildResultCardSvg(state, grid, result) {
  const teams = state.setup.teams;
  const body = renderEdgesAndDots(state, grid);
  const b = grid.bounds;

  const gridContentW = (b.maxX - b.minX) + 2 * PAD;
  const gridContentH = (b.maxY - b.minY) + 2 * PAD;
  const innerW = CARD_W - 2 * PAD;
  const aspect = gridContentH / gridContentW;
  const gridRenderH = innerW * aspect;
  const cardH = TITLE_H + gridRenderH + STATS_H + PAD;

  const winnerColor = result.winner === 'tie' ? '#f59e0b' : teams[result.winner].color;
  const winnerLabel = result.winner === 'tie' ? 'Tie game' : `${teams[result.winner].name} wins`;
  const modeLabel = state.setup.winMode === 'tree' ? 'Largest tree' : 'Longest line';
  const date = new Date().toISOString().slice(0, 10);

  const aLine = longestLine(state, 'A');
  const bLine = longestLine(state, 'B');
  const aTree = largestTree(state, 'A');
  const bTree = largestTree(state, 'B');
  const aDots = dotsCovered(state, 'A');
  const bDots = dotsCovered(state, 'B');

  const innerVB = `${b.minX - PAD} ${b.minY - PAD} ${gridContentW} ${gridContentH}`;
  const rowAY = TITLE_H + gridRenderH + 64;
  const rowBY = TITLE_H + gridRenderH + 134;

  return `<svg xmlns="${SVG_NS}" width="${CARD_W}" height="${cardH}" viewBox="0 0 ${CARD_W} ${cardH}">
  <rect width="${CARD_W}" height="${cardH}" fill="#0d1117"/>
  <text x="${CARD_W / 2}" y="48" text-anchor="middle" font-family='${FONT}' font-size="30" font-weight="700" fill="${winnerColor}">${esc(winnerLabel)}</text>
  <text x="${CARD_W / 2}" y="74" text-anchor="middle" font-family='${FONT}' font-size="14" fill="#8b949e">${esc(modeLabel)} · ${state.moveLog.length} moves · ${state.setup.rows}×${state.setup.cols} board</text>
  <svg x="${PAD}" y="${TITLE_H}" width="${innerW}" height="${gridRenderH}" viewBox="${innerVB}" preserveAspectRatio="xMidYMid meet">${body}</svg>
  <line x1="${PAD}" y1="${TITLE_H + gridRenderH + 24}" x2="${CARD_W - PAD}" y2="${TITLE_H + gridRenderH + 24}" stroke="#2a313c"/>
  <text x="${PAD}" y="${rowAY}" font-family='${FONT}' font-size="22" font-weight="600" fill="${teams.A.color}">${esc(teams.A.name)}</text>
  <text x="${CARD_W - PAD}" y="${rowAY}" text-anchor="end" font-family='${FONT}' font-size="34" font-weight="700" fill="${teams.A.color}">${result.scores.A}</text>
  <text x="${PAD}" y="${rowAY + 24}" font-family='${FONT}' font-size="13" fill="#8b949e">${aDots} dots covered · Longest line ${aLine} · Largest tree ${aTree}</text>
  <text x="${PAD}" y="${rowBY}" font-family='${FONT}' font-size="22" font-weight="600" fill="${teams.B.color}">${esc(teams.B.name)}</text>
  <text x="${CARD_W - PAD}" y="${rowBY}" text-anchor="end" font-family='${FONT}' font-size="34" font-weight="700" fill="${teams.B.color}">${result.scores.B}</text>
  <text x="${PAD}" y="${rowBY + 24}" font-family='${FONT}' font-size="13" fill="#8b949e">${bDots} dots covered · Longest line ${bLine} · Largest tree ${bTree}</text>
  <text x="${CARD_W / 2}" y="${cardH - 20}" text-anchor="middle" font-family='${FONT}' font-size="12" fill="#58a6ff">dhruvinrsoni.github.io/rangoli-royale · ${date}</text>
</svg>`;
}

export async function buildResultCardPng(state, grid, result) {
  const svgString = buildResultCardSvg(state, grid, result);
  const svgBlob = new Blob([svgString], { type: 'image/svg+xml;charset=utf-8' });
  const url = URL.createObjectURL(svgBlob);

  try {
    const img = new Image();
    await new Promise((resolve, reject) => {
      img.onload = resolve;
      img.onerror = () => reject(new Error('SVG image failed to load'));
      img.src = url;
    });

    const scale = 2;
    const canvas = document.createElement('canvas');
    canvas.width = (img.naturalWidth || CARD_W) * scale;
    canvas.height = (img.naturalHeight || CARD_W) * scale;
    const ctx = canvas.getContext('2d');
    ctx.scale(scale, scale);
    ctx.drawImage(img, 0, 0);

    return await new Promise((resolve, reject) => {
      canvas.toBlob(
        b => (b ? resolve(b) : reject(new Error('canvas → png conversion returned null'))),
        'image/png'
      );
    });
  } finally {
    URL.revokeObjectURL(url);
  }
}
