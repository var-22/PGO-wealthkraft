// Small per-device choices (theme, hide amounts). Kept in this browser only; the app works the
// same if the browser refuses storage.
const PREFIX = "pgo-";

export function readPref(key, fallback) {
  try {
    return window.localStorage.getItem(PREFIX + key) ?? fallback;
  } catch {
    return fallback;
  }
}

export function writePref(key, value) {
  try {
    window.localStorage.setItem(PREFIX + key, value);
  } catch {
    // private window or storage blocked: the choice simply lasts until the app is closed
  }
}

export const THEMES = [
  { key: "system", label: "Auto" },
  { key: "light", label: "Light" },
  { key: "dark", label: "Dark" },
];

/** "system" follows the phone's setting; "light" and "dark" override it. */
export function applyTheme(theme) {
  const root = document.documentElement;
  if (theme === "light" || theme === "dark") root.dataset.theme = theme;
  else delete root.dataset.theme;
}
