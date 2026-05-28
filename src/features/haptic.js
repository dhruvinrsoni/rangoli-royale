import { isEnabled } from '../config/features.js';

const PATTERNS = Object.freeze({
  tap: 10,
  invalid: 80,
  turn: [20, 40, 20],
  victory: [30, 60, 30, 60, 100],
});

export function buzz(pattern = 'tap') {
  if (!isEnabled('hapticFeedback')) return;
  if (typeof navigator === 'undefined' || !navigator.vibrate) return;
  try {
    navigator.vibrate(PATTERNS[pattern] ?? pattern);
  } catch {}
}
