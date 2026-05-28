import { isEnabled } from '../config/features.js';

let audioCtx = null;

function ensureCtx() {
  if (audioCtx) return audioCtx;
  if (typeof window === 'undefined') return null;
  const Ctx = window.AudioContext || window.webkitAudioContext;
  if (!Ctx) return null;
  audioCtx = new Ctx();
  return audioCtx;
}

function blip({ frequency, durationMs, type = 'sine', gain = 0.06 }) {
  const ctx = ensureCtx();
  if (!ctx) return;
  const osc = ctx.createOscillator();
  const gainNode = ctx.createGain();
  osc.type = type;
  osc.frequency.value = frequency;
  gainNode.gain.setValueAtTime(gain, ctx.currentTime);
  gainNode.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + durationMs / 1000);
  osc.connect(gainNode).connect(ctx.destination);
  osc.start();
  osc.stop(ctx.currentTime + durationMs / 1000);
}

export function playMoveBlip() {
  if (!isEnabled('soundFx')) return;
  blip({ frequency: 660, durationMs: 90, type: 'triangle' });
}

export function playTurnEndChime() {
  if (!isEnabled('soundFx')) return;
  blip({ frequency: 880, durationMs: 140, type: 'sine' });
}

export function playInvalidBuzz() {
  if (!isEnabled('soundFx')) return;
  blip({ frequency: 180, durationMs: 200, type: 'square', gain: 0.04 });
}
