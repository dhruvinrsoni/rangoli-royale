function parseEdgeId(id) {
  const parts = id.split('-');
  const prefix = parts[0];
  return {
    orientation: prefix[0] === 'v' ? 'vertical' : 'horizontal',
    team: prefix[1],
    col: parseInt(parts[1], 10),
    row: parseInt(parts[2], 10),
  };
}

function dotsOfEdge(edgeId) {
  const { orientation, team, col, row } = parseEdgeId(edgeId);
  if (orientation === 'vertical') {
    return [`d${team}-${col}-${row}`, `d${team}-${col}-${row + 1}`];
  }
  return [`d${team}-${col}-${row}`, `d${team}-${col + 1}-${row}`];
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

export function dotsCovered(state, team) {
  const dots = new Set();
  for (const m of state.moveLog) {
    if (m.team !== team) continue;
    const [a, b] = dotsOfEdge(m.edgeId);
    dots.add(a);
    dots.add(b);
  }
  return dots.size;
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

function buildTeamGraph(state, team) {
  const graph = new Map();
  for (const m of state.moveLog) {
    if (m.team !== team) continue;
    const [a, b] = dotsOfEdge(m.edgeId);
    if (!graph.has(a)) graph.set(a, new Set());
    if (!graph.has(b)) graph.set(b, new Set());
    graph.get(a).add(b);
    graph.get(b).add(a);
  }
  return graph;
}

function getConnectedComponents(graph) {
  const visited = new Set();
  const components = [];
  for (const start of graph.keys()) {
    if (visited.has(start)) continue;
    const component = new Set();
    const stack = [start];
    while (stack.length > 0) {
      const node = stack.pop();
      if (visited.has(node)) continue;
      visited.add(node);
      component.add(node);
      for (const neighbor of graph.get(node)) {
        if (!visited.has(neighbor)) stack.push(neighbor);
      }
    }
    components.push(component);
  }
  return components;
}

function countComponentEdges(graph, component) {
  let edges = 0;
  for (const node of component) {
    for (const neighbor of graph.get(node)) {
      if (component.has(neighbor)) edges++;
    }
  }
  return edges / 2;
}

function bfsFarthest(graph, start, component) {
  const dist = new Map();
  dist.set(start, 0);
  const queue = [start];
  let farthest = { node: start, dist: 0 };
  while (queue.length > 0) {
    const node = queue.shift();
    const d = dist.get(node);
    for (const neighbor of graph.get(node)) {
      if (!component.has(neighbor)) continue;
      if (dist.has(neighbor)) continue;
      const nd = d + 1;
      dist.set(neighbor, nd);
      if (nd > farthest.dist) farthest = { node: neighbor, dist: nd };
      queue.push(neighbor);
    }
  }
  return farthest;
}

function treeDiameterDots(graph, component) {
  const start = component.values().next().value;
  const far1 = bfsFarthest(graph, start, component);
  const far2 = bfsFarthest(graph, far1.node, component);
  return far2.dist + 1;
}

const DFS_OP_CAP = 200000;

function longestPathDots(graph, component) {
  let best = 1;
  let ops = 0;
  const visited = new Set();
  function dfs(node, length) {
    if (ops >= DFS_OP_CAP) return;
    ops++;
    if (length > best) best = length;
    visited.add(node);
    for (const neighbor of graph.get(node)) {
      if (!component.has(neighbor)) continue;
      if (!visited.has(neighbor)) dfs(neighbor, length + 1);
    }
    visited.delete(node);
  }
  for (const start of component) {
    if (ops >= DFS_OP_CAP) break;
    dfs(start, 1);
  }
  return best;
}

export function longestLine(state, team) {
  const graph = buildTeamGraph(state, team);
  if (graph.size === 0) return 0;

  let best = 1;
  for (const component of getConnectedComponents(graph)) {
    const nNodes = component.size;
    const nEdges = countComponentEdges(graph, component);
    const pathLen = nEdges === nNodes - 1
      ? treeDiameterDots(graph, component)
      : longestPathDots(graph, component);
    if (pathLen > best) best = pathLen;
  }
  return best;
}
