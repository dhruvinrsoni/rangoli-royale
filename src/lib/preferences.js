import { getSettings, updateSettings } from './storage.js';
import { isEnabled } from '../config/features.js';

const PREF_DEFAULTS = Object.freeze({
  soundFx: false,
  haptic: true,
});

export function getPref(name) {
  if (!isEnabled(featureFor(name))) return false;
  const settings = getSettings();
  const prefs = settings.prefs || {};
  return name in prefs ? !!prefs[name] : PREF_DEFAULTS[name];
}

export function setPref(name, value) {
  const settings = getSettings();
  const prefs = { ...(settings.prefs || {}), [name]: !!value };
  updateSettings({ prefs });
}

function featureFor(prefName) {
  return prefName === 'haptic' ? 'hapticFeedback' : prefName;
}

export { PREF_DEFAULTS };
