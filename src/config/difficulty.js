export const DIFFICULTY_PRESETS = Object.freeze([
  { label: 'Easy',   rows: 4, cols: 4, minPlayers: 2,  maxPlayers: 4 },
  { label: 'Medium', rows: 6, cols: 6, minPlayers: 4,  maxPlayers: 6 },
  { label: 'Hard',   rows: 8, cols: 8, minPlayers: 6,  maxPlayers: 10 },
  { label: 'Epic',   rows: 10, cols: 10, minPlayers: 8, maxPlayers: 12 },
]);

export function suggestedDifficulty(playerCount) {
  for (const preset of DIFFICULTY_PRESETS) {
    if (playerCount <= preset.maxPlayers) return preset;
  }
  return DIFFICULTY_PRESETS[DIFFICULTY_PRESETS.length - 1];
}
