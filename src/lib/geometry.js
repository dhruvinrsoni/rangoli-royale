export const TEAMS = Object.freeze(['A', 'B']);

export function teamForColumn(col) {
  return col % 2 === 0 ? 'A' : 'B';
}

export function generateGrid({ rows, cols, spacing = 40 }) {
  if (!Number.isInteger(rows) || !Number.isInteger(cols) || rows < 2 || cols < 2) {
    throw new Error(`Grid requires integer rows >= 2 and cols >= 2, got rows=${rows} cols=${cols}`);
  }

  const dots = [];
  for (let row = 0; row < rows; row++) {
    for (let col = 0; col < cols; col++) {
      dots.push({
        id: `d-${col}-${row}`,
        col,
        row,
        team: teamForColumn(col),
        x: col * spacing,
        y: row * spacing,
      });
    }
  }

  const dotById = new Map(dots.map(d => [d.id, d]));
  const dotAt = (col, row) => dotById.get(`d-${col}-${row}`);

  const legalEdges = [];

  for (let col = 0; col < cols; col++) {
    for (let row = 0; row < rows - 1; row++) {
      const a = dotAt(col, row);
      const b = dotAt(col, row + 1);
      legalEdges.push({
        id: `v-${col}-${row}`,
        a: a.id,
        b: b.id,
        orientation: 'vertical',
        team: a.team,
        x1: a.x, y1: a.y, x2: b.x, y2: b.y,
      });
    }
  }

  for (let row = 0; row < rows; row++) {
    for (let col = 0; col + 2 < cols; col++) {
      const a = dotAt(col, row);
      const b = dotAt(col + 2, row);
      legalEdges.push({
        id: `h-${col}-${row}`,
        a: a.id,
        b: b.id,
        orientation: 'horizontal',
        team: a.team,
        x1: a.x, y1: a.y, x2: b.x, y2: b.y,
      });
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

  return {
    rows,
    cols,
    spacing,
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
