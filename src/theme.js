export const LIGHT_THEME = {
  cream: '#FFF8F0', surface: '#FFFDF8', white: '#FFFFFF',
  honey: '#DD9A33', honeyDeep: '#B97A1F', honeyLight: '#FFF3D6',
  honeyMid: '#F5DFA0', blush: '#FDE8E0', blushDeep: '#E8907A',
  text: '#2E1F12', muted: '#B89A6A', mutedLight: '#D4BC94',
  border: '#EFE4CC', borderLight: '#F7EDD8',
};

export const DARK_THEME = {
  cream: '#1C140C', surface: '#241B12', white: '#2A2018',
  honey: '#E8B45A', honeyDeep: '#F0C878', honeyLight: '#3A2C18',
  honeyMid: '#5A4426', blush: '#3A2620', blushDeep: '#D89A88',
  text: '#F0E4D2', muted: '#9A8262', mutedLight: '#6E5A42',
  border: '#3A2E1E', borderLight: '#2E2416',
};

export const DARK_MODE_STORAGE_KEY = 'ourhome_dark_mode';

export function getSavedDarkMode() {
  const saved = localStorage.getItem(DARK_MODE_STORAGE_KEY);
  if (saved === 'true') return true;
  if (saved === 'false') return false;
  return document.documentElement.dataset.theme === 'dark';
}

export function applyDocumentTheme(darkMode) {
  const isDark = Boolean(darkMode);
  document.documentElement.dataset.theme = isDark ? 'dark' : 'light';
  document.documentElement.style.colorScheme = isDark ? 'dark' : 'light';
  localStorage.setItem(DARK_MODE_STORAGE_KEY, String(isDark));
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content', isDark ? '#17111F' : '#E9A641');
}
