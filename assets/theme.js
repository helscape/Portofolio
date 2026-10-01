/**
 * Theme toggling and persistence.
 *
 * The initial theme is applied by an inline snippet in <head> so that
 * the correct colors paint on the first frame. This module handles
 * only user-initiated changes: it flips [data-theme] on <html>,
 * persists the choice to localStorage, and keeps the browser chrome
 * color (meta[name="theme-color"]) in sync.
 *
 * The stored value overrides prefers-color-scheme on subsequent
 * visits. Storage failures (private mode, disabled cookies) are
 * ignored — the toggle still works, it just doesn't persist.
 */

const STORAGE_KEY = 'theme';
const CHROME_LIGHT = '#faf9f5';
const CHROME_DARK = '#131211';

/** @returns {'light' | 'dark'} the currently applied theme. */
function currentTheme() {
  return document.documentElement.dataset.theme === 'dark' ? 'dark' : 'light';
}

/**
 * Update the browser-chrome color to match the active theme.
 * @param {'light' | 'dark'} theme
 */
function syncMetaThemeColor(theme) {
  const meta = document.querySelector('meta[name="theme-color"]');
  if (meta) meta.content = theme === 'dark' ? CHROME_DARK : CHROME_LIGHT;
}

/**
 * Flip to the opposite theme, persist the choice, and update chrome.
 * Invoked from the top-bar toggle button.
 */
function toggleTheme() {
  const next = currentTheme() === 'dark' ? 'light' : 'dark';
  document.documentElement.dataset.theme = next;
  try { localStorage.setItem(STORAGE_KEY, next); } catch (_) {}
  syncMetaThemeColor(next);
}
