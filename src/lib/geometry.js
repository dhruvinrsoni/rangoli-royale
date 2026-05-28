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

  return {
    rows,
    cols,
    spacing,
    dots,
    legalEdges,
    dotById,
    edgeById,
    dotAt,
  };
}

export function edgesByTeam(grid, team) {
  return grid.legalEdges.filter(e => e.team === team);
}
