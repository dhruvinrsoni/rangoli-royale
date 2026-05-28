import { isEnabled } from '../config/features.js';

const DEFAULT_SECONDS = 30;
let intervalId = null;
let onExpiry = null;

export function startTimer({ seconds = DEFAULT_SECONDS, onTick, onExpire }) {
  if (!isEnabled('turnTimer')) return null;
  stopTimer();
  let remaining = seconds;
  onExpiry = onExpire;
  if (onTick) onTick(remaining);
  intervalId = setInterval(() => {
    remaining -= 1;
    if (onTick) onTick(remaining);
    if (remaining <= 0) {
      stopTimer();
      if (onExpiry) onExpiry();
    }
  }, 1000);
  return intervalId;
}

export function stopTimer() {
  if (intervalId) {
    clearInterval(intervalId);
    intervalId = null;
  }
  onExpiry = null;
}
