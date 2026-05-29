export function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

export function computeStateKey(state) {
  if (!state) return 'null';
  const players = state.players?.map(p => `${p.seat}:${p.team}:${p.clientId?.slice(-4) || ''}`).join(',') || '';
  return [
    state.moveLog?.length ?? 0,
    state.status,
    state.players?.length ?? 0,
    state.hostSeat ?? '',
    state.endReason ?? '',
    players,
  ].join('|');
}
