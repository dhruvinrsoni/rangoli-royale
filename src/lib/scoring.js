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

function dotsOfEdge(edgeId) {
  const { orientation, col, row } = parseEdgeId(edgeId);
  if (orientation === 'vertical') {
    return [`d-${col}-${row}`, `d-${col}-${row + 1}`];
  }
  return [`d-${col}-${row}`, `d-${col + 2}-${row}`];
}

class UnionFind {
  constructor() {
    this.parent = new Map();
    this.size = new Map();
  }
  add(x) {
    if (!this.parent.has(x)) {
      this.parent.set(x, x);
      this.size.set(x, 1);
    }
  }
  find(x) {
    let root = x;
    while (this.parent.get(root) !== root) root = this.parent.get(root);
    let node = x;
    while (this.parent.get(node) !== root) {
      const next = this.parent.get(node);
      this.parent.set(node, root);
      node = next;
    }
    return root;
  }
  union(x, y) {
    this.add(x);
    this.add(y);
    const rx = this.find(x);
    const ry = this.find(y);
    if (rx === ry) return;
    const sx = this.size.get(rx);
    const sy = this.size.get(ry);
    if (sx >= sy) {
      this.parent.set(ry, rx);
      this.size.set(rx, sx + sy);
    } else {
      this.parent.set(rx, ry);
      this.size.set(ry, sx + sy);
    }
  }
  largestSize() {
    let max = 0;
    for (const [k, v] of this.parent) {
      if (k === v) {
        const s = this.size.get(k);
        if (s > max) max = s;
      }
    }
    return max;
  }
}

export function largestTree(state, team) {
  const uf = new UnionFind();
  for (const m of state.moveLog) {
    if (m.team !== team) continue;
    const [a, b] = dotsOfEdge(m.edgeId);
    uf.union(a, b);
  }
  return uf.largestSize();
}

export function scoreFor(state, team) {
  return state.setup.winMode === 'tree' ? largestTree(state, team) : longestLine(state, team);
}

export function determineWinner(state) {
  const a = scoreFor(state, 'A');
  const b = scoreFor(state, 'B');
  if (a > b) return { winner: 'A', scores: { A: a, B: b } };
  if (b > a) return { winner: 'B', scores: { A: a, B: b } };
  return { winner: 'tie', scores: { A: a, B: b } };
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
