import { applyMove, undoLastMove } from '../../src/lib/turn-engine.js';

const ALPHABET = '0123456789';
const CODE_LENGTH = 8;

export function generateCode() {
  let out = '';
  for (let i = 0; i < CODE_LENGTH; i++) {
    out += ALPHABET[Math.floor(Math.random() * ALPHABET.length)];
  }
  return out;
}

export function normalizeCode(raw) {
  if (typeof raw !== 'string') return '';
  return raw.replace(/[^0-9]/g, '').slice(0, CODE_LENGTH);
}

export function nowMs() {
  return Date.now();
}

export function makeInitialRoomState({ setup, hostName, hostClientId }) {
  const startingTeam = Math.random() < 0.5 ? 'A' : 'B';
  return {
    setup: { ...setup, startingTeam, createdAt: nowMs() },
    status: 'lobby',
    players: [
      { seat: 1, clientId: hostClientId, name: hostName || 'Host', team: 'A', joinedAt: nowMs(), lastSeen: nowMs() },
    ],
    hostSeat: 1,
    moveLog: [],
    endedAt: null,
  };
}

export function joinRoom(state, { clientId, name }) {
  if (state.status !== 'lobby') throw new RoomError('ROOM_STARTED', 'Game already started');
  if (state.players.some(p => p.clientId === clientId)) {
    return touchPlayer(state, clientId);
  }
  if (state.players.length >= state.setup.playerCount) {
    throw new RoomError('ROOM_FULL', 'Room is full');
  }
  const seat = state.players.length + 1;
  const team = seat % 2 === 1 ? 'A' : 'B';
  const newPlayer = { seat, clientId, name: name || `Player ${seat}`, team, joinedAt: nowMs(), lastSeen: nowMs() };
  return { ...state, players: [...state.players, newPlayer] };
}

export function startGame(state, clientId) {
  if (state.status !== 'lobby') throw new RoomError('BAD_STATE', 'Game already started');
  const host = state.players.find(p => p.seat === state.hostSeat);
  if (!host || host.clientId !== clientId) throw new RoomError('NOT_HOST', 'Only the host can start');
  if (state.players.length < 2) throw new RoomError('NOT_ENOUGH', 'Need at least 2 players');
  return { ...state, status: 'in-progress', startedAt: nowMs() };
}

export function applyServerMove(state, { clientId, edgeId }) {
  if (state.status !== 'in-progress') throw new RoomError('BAD_STATE', 'Game not running');
  const player = state.players.find(p => p.clientId === clientId);
  if (!player) throw new RoomError('NOT_IN_ROOM', 'You are not in this room');
  const engineState = stateForEngine(state);
  const after = applyMove(engineState, edgeId);
  if (after.moveLog.length === engineState.moveLog.length) {
    throw new RoomError('INVALID_MOVE', 'Move was not accepted');
  }
  const lastMove = after.moveLog[after.moveLog.length - 1];
  if (lastMove.team !== player.team) {
    throw new RoomError('WRONG_TEAM', 'Not your team\'s turn');
  }
  return {
    ...state,
    moveLog: after.moveLog,
    status: after.status,
    endedAt: after.status === 'ended' ? nowMs() : state.endedAt,
    players: state.players.map(p => p.clientId === clientId ? { ...p, lastSeen: nowMs() } : p),
  };
}

export function leaveRoom(state, clientId) {
  const leaver = state.players.find(p => p.clientId === clientId);
  const remaining = state.players.filter(p => p.clientId !== clientId);
  if (remaining.length === 0) return null;

  let next = { ...state, players: remaining };

  if (leaver && leaver.seat === state.hostSeat) {
    next.hostSeat = remaining[0].seat;
  }

  if (state.status === 'in-progress') {
    next.status = 'ended';
    next.endReason = `${leaver?.name || 'A player'} left the room`;
    next.endedAt = nowMs();
  }

  return next;
}

export function touchPlayer(state, clientId) {
  return {
    ...state,
    players: state.players.map(p => p.clientId === clientId ? { ...p, lastSeen: nowMs() } : p),
  };
}

export function stateForEngine(roomState) {
  return {
    setup: roomState.setup,
    moveLog: roomState.moveLog,
    status: roomState.status,
  };
}

export class RoomError extends Error {
  constructor(code, message) {
    super(message);
    this.code = code;
  }
}
