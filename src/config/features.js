export const FEATURES = Object.freeze({
  teamNames: true,
  hapticFeedback: true,
  undoMove: true,

  turnTimer: false,
  soundFx: false,

  colorFillBossMode: false,
  socialShare: false,
  onlineMultiplayer: false,
});

export function isEnabled(flag) {
  return FEATURES[flag] === true;
}
