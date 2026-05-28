import { generateGrid } from './geometry.js';

export const MoveError = Object.freeze({
  UNKNOWN_EDGE: 'unknown-edge',
  WRONG_TEAM: 'wrong-team',
  ALREADY_CLAIMED: 'already-claimed',
  BLOCKED_BY_CROSSING: 'blocked-by-crossing',
  GAME_ENDED: 'game-ended',
});

export class InvalidMoveError extends Error {
  constructor(code, detail) {
    super(detail ? `${code}: ${detail}` : code);
    this.code = code;
    this.detail = detail;
  }
}

const otherTeam = t => (t === 'A' ? 'B' : 'A');

export function createGame({ rows, cols, spacing = 40, playerCount, winMode, teams, startingTeam }) {
  if (!Number.isInteger(playerCount) || playerCount < 2 || playerCount % 2 !== 0) {
    throw new Error(`playerCount must be an even integer >= 2, got ${playerCount}`);
  }
  if (!['line', 'tree'].includes(winMode)) {
    throw new Error(`winMode must be 'line' or 'tree', got ${winMode}`);
  }
  if (!teams || !teams.A || !teams.B) {
    throw new Error('teams.A and teams.B are required');
  }
  const resolvedStartingTeam = startingTeam || (Math.random() < 0.5 ? 'A' : 'B');
  return {
    setup: {
      rows,
      cols,
      spacing,
      playerCount,
      winMode,
      teams: { A: { ...teams.A }, B: { ...teams.B } },
      startingTeam: resolvedStartingTeam,
      createdAt: Date.now(),
    },
    moveLog: [],
    status: 'in-progress',
  };
}

export function deriveGrid(state) {
  return generateGrid({
    rows: state.setup.rows,
    cols: state.setup.cols,
    spacing: state.setup.spacing,
  });
}

export function claimedEdges(state) {
  const map = new Map();
  state.moveLog.forEach((m, i) => map.set(m.edgeId, { team: m.team, moveIndex: i }));
  return map;
}

export function legalMovesFor(state, team, grid = deriveGrid(state)) {
  const claimed = claimedEdges(state);
  const legal = [];
  for (const edge of grid.legalEdges) {
    if (edge.team !== team) continue;
    if (claimed.has(edge.id)) continue;
    let blocked = false;
    for (const otherId of grid.crossings.get(edge.id)) {
      if (claimed.has(otherId)) { blocked = true; break; }
    }
    if (!blocked) legal.push(edge.id);
  }
  return legal;
}

export function currentTeam(state, grid = deriveGrid(state)) {
  if (state.status !== 'in-progress') return null;
  if (state.moveLog.length === 0) return state.setup.startingTeam;
  const last = state.moveLog[state.moveLog.length - 1];
  const other = otherTeam(last.team);
  if (legalMovesFor(state, other, grid).length > 0) return other;
  if (legalMovesFor(state, last.team, grid).length > 0) return last.team;
  return null;
}

export function turnNumberForTeam(state, team) {
  return state.moveLog.filter(m => m.team === team).length + 1;
}

export function applyMove(state, edgeId) {
  if (state.status !== 'in-progress') {
    throw new InvalidMoveError(MoveError.GAME_ENDED);
  }
  const grid = deriveGrid(state);
  const edge = grid.edgeById.get(edgeId);
  if (!edge) throw new InvalidMoveError(MoveError.UNKNOWN_EDGE, edgeId);

  const team = currentTeam(state, grid);
  if (team === null) {
    return { ...state, status: 'ended' };
  }
  if (edge.team !== team) {
    throw new InvalidMoveError(MoveError.WRONG_TEAM, `${edgeId} belongs to ${edge.team}, current is ${team}`);
  }
  const claimed = claimedEdges(state);
  if (claimed.has(edgeId)) throw new InvalidMoveError(MoveError.ALREADY_CLAIMED, edgeId);
  for (const otherId of grid.crossings.get(edgeId)) {
    if (claimed.has(otherId)) {
      throw new InvalidMoveError(MoveError.BLOCKED_BY_CROSSING, otherId);
    }
  }

  const newState = {
    ...state,
    moveLog: [...state.moveLog, { team, edgeId }],
  };

  const aHas = legalMovesFor(newState, 'A', grid).length > 0;
  const bHas = legalMovesFor(newState, 'B', grid).length > 0;
  if (!aHas && !bHas) {
    newState.status = 'ended';
  }
  return newState;
}

export function undoLastMove(state) {
  if (state.moveLog.length === 0) return state;
  return {
    ...state,
    moveLog: state.moveLog.slice(0, -1),
    status: 'in-progress',
  };
}
