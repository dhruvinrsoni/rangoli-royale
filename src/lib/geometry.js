export const TEAMS = Object.freeze(['A', 'B']);

const SHAPE_FILTERS = Object.freeze({
  rectangle: () => true,
  diamond: (x, y, cx, cy, half) =>
    Math.abs(x - cx) + Math.abs(y - cy) <= half,
  circle: (x, y, cx, cy, half) => {
    const dx = x - cx;
    const dy = y - cy;
    return dx * dx + dy * dy <= half * half;
  },
  hexagon: (x, y, cx, cy, half) => {
    const dx = Math.abs(x - cx);
    const dy = Math.abs(y - cy);
    return dx + dy <= half && dy <= half * 0.75;
  },
});

export const SHAPES = Object.freeze(Object.keys(SHAPE_FILTERS));

export function generateGrid({ rows, cols, spacing = 40, shape = 'rectangle' }) {
  if (!Number.isInteger(rows) || !Number.isInteger(cols) || rows < 2 || cols < 2) {
    throw new Error(`Grid requires integer rows >= 2 and cols >= 2, got rows=${rows} cols=${cols}`);
  }

  const filter = SHAPE_FILTERS[shape] || SHAPE_FILTERS.rectangle;
  const cx = (cols - 1) / 2;
  const cy = (rows - 1) / 2;
  const half = Math.min(rows, cols) / 2;
  const includesPoint = (x, y) => filter(x, y, cx, cy, half);

  const dots = [];

  for (let row = 0; row < rows; row++) {
    for (let col = 0; col < cols; col++) {
      if (!includesPoint(col, row)) continue;
      dots.push({
        id: `dA-${col}-${row}`,
        team: 'A',
        col,
        row,
        x: col * spacing,
        y: row * spacing,
      });
    }
  }

  for (let row = 0; row < rows; row++) {
    for (let col = 0; col < cols; col++) {
      if (!includesPoint(col, row)) continue;
      dots.push({
        id: `dB-${col}-${row}`,
        team: 'B',
        col,
        row,
        x: (col + 0.5) * spacing,
        y: (row + 0.5) * spacing,
      });
    }
  }

  const dotById = new Map(dots.map(d => [d.id, d]));
  const dotAt = (team, col, row) => dotById.get(`d${team}-${col}-${row}`);

  const legalEdges = [];

  for (const team of TEAMS) {
    for (let row = 0; row < rows; row++) {
      for (let col = 0; col + 1 < cols; col++) {
        const a = dotAt(team, col, row);
        const b = dotAt(team, col + 1, row);
        if (!a || !b) continue;
        legalEdges.push({
          id: `h${team}-${col}-${row}`,
          a: a.id,
          b: b.id,
          orientation: 'horizontal',
          team,
          x1: a.x, y1: a.y, x2: b.x, y2: b.y,
        });
      }
    }
    for (let col = 0; col < cols; col++) {
      for (let row = 0; row + 1 < rows; row++) {
        const a = dotAt(team, col, row);
        const b = dotAt(team, col, row + 1);
        if (!a || !b) continue;
        legalEdges.push({
          id: `v${team}-${col}-${row}`,
          a: a.id,
          b: b.id,
          orientation: 'vertical',
          team,
          x1: a.x, y1: a.y, x2: b.x, y2: b.y,
        });
      }
    }
  }

  const edgeById = new Map(legalEdges.map(e => [e.id, e]));

  const crossings = new Map();
  for (const e of legalEdges) crossings.set(e.id, new Set());
  for (let i = 0; i < legalEdges.length; i++) {
    for (let j = i + 1; j < legalEdges.length; j++) {
      const e1 = legalEdges[i];
      const e2 = legalEdges[j];
      if (e1.team === e2.team) continue;
      if (edgesIntersect(e1, e2)) {
        crossings.get(e1.id).add(e2.id);
        crossings.get(e2.id).add(e1.id);
      }
    }
  }

  let minX = 0, minY = 0, maxX = 0, maxY = 0;
  if (dots.length > 0) {
    minX = Infinity; minY = Infinity; maxX = -Infinity; maxY = -Infinity;
    for (const d of dots) {
      if (d.x < minX) minX = d.x;
      if (d.y < minY) minY = d.y;
      if (d.x > maxX) maxX = d.x;
      if (d.y > maxY) maxY = d.y;
    }
  }

  return {
    rows,
    cols,
    spacing,
    shape,
    bounds: { minX, minY, maxX, maxY },
    dots,
    legalEdges,
    dotById,
    edgeById,
    dotAt,
    crossings,
  };
}

export function edgesByTeam(grid, team) {
  return grid.legalEdges.filter(e => e.team === team);
}

export function edgesIntersect(e1, e2) {
  if (e1.orientation === 'horizontal' && e2.orientation === 'horizontal') {
    if (e1.y1 !== e2.y1) return false;
    return Math.max(Math.min(e1.x1, e1.x2), Math.min(e2.x1, e2.x2))
        <= Math.min(Math.max(e1.x1, e1.x2), Math.max(e2.x1, e2.x2));
  }
  if (e1.orientation === 'vertical' && e2.orientation === 'vertical') {
    if (e1.x1 !== e2.x1) return false;
    return Math.max(Math.min(e1.y1, e1.y2), Math.min(e2.y1, e2.y2))
        <= Math.min(Math.max(e1.y1, e1.y2), Math.max(e2.y1, e2.y2));
  }
  const h = e1.orientation === 'horizontal' ? e1 : e2;
  const v = e1.orientation === 'vertical' ? e1 : e2;
  const hy = h.y1;
  const vx = v.x1;
  const hxmin = Math.min(h.x1, h.x2);
  const hxmax = Math.max(h.x1, h.x2);
  const vymin = Math.min(v.y1, v.y2);
  const vymax = Math.max(v.y1, v.y2);
  return vx >= hxmin && vx <= hxmax && hy >= vymin && hy <= vymax;
}
