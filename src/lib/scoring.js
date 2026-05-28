function parseEdgeId(id) {
  const parts = id.split('-');
  return {
    orientation: parts[0] === 'v' ? 'vertical' : 'horizontal',
    col: parseInt(parts[1], 10),
    row: parseInt(parts[2], 10),
  };
}

function longestRun(values, step) {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  let longest = 1;
  let current = 1;
  for (let i = 1; i < sorted.length; i++) {
    if (sorted[i] === sorted[i - 1] + step) {
      current++;
      if (current > longest) longest = current;
    } else {
      current = 1;
    }
  }
  return longest;
}

export function longestLine(state, team) {
  const teamEdgeIds = state.moveLog.filter(m => m.team === team).map(m => m.edgeId);
  if (teamEdgeIds.length === 0) return 0;

  const verticalsByCol = new Map();
  const horizontalsByRow = new Map();
  for (const id of teamEdgeIds) {
    const { orientation, col, row } = parseEdgeId(id);
    if (orientation === 'vertical') {
      if (!verticalsByCol.has(col)) verticalsByCol.set(col, []);
      verticalsByCol.get(col).push(row);
    } else {
      if (!horizontalsByRow.has(row)) horizontalsByRow.set(row, []);
      horizontalsByRow.get(row).push(col);
    }
  }

  let longest = 0;
  for (const rows of verticalsByCol.values()) {
    const run = longestRun(rows, 1);
    if (run > longest) longest = run;
  }
  for (const cols of horizontalsByRow.values()) {
    const run = longestRun(cols, 2);
    if (run > longest) longest = run;
  }
  return longest;
}
