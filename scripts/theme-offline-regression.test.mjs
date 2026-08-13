import assert from 'node:assert/strict';
import test from 'node:test';
import { readFile } from 'node:fs/promises';

const [contextSource, themeSource, settingsSource] = await Promise.all([
  readFile(new URL('../src/ThemeContext.jsx', import.meta.url), 'utf8'),
  readFile(new URL('../src/theme.js', import.meta.url), 'utf8'),
  readFile(new URL('../src/SettingsRoom.jsx', import.meta.url), 'utf8'),
]);

test('theme remains a device-owned preference while cloud settings are stale', () => {
  assert.match(contextSource, /hasLocalDarkModePreferenceRef = useRef\(hasSavedDarkMode\(\)\)/);
  assert.match(contextSource, /const localDarkMode = getSavedDarkMode\(\)/);
  assert.match(contextSource, /nextSettings = \{ \.\.\.cloudSettings, dark_mode: localDarkMode \}/);
  assert.doesNotMatch(contextSource, /setDarkMode\(nextSettings\.dark_mode, \{ persist: false \}\)/);
});

test('a fresh device may seed once from cloud and storage denial cannot block the switch', () => {
  assert.match(themeSource, /export function hasSavedDarkMode\(\)/);
  assert.match(contextSource, /setDarkModeState\(cloudSettings\.dark_mode\)/);
  assert.match(themeSource, /try \{\s*localStorage\.setItem\(DARK_MODE_STORAGE_KEY, String\(isDark\)\)/);
});

test('the day and night switch stays directly clickable without cloud gating', () => {
  assert.match(settingsSource, /onClick=\{toggleDarkMode\}/);
  assert.doesNotMatch(settingsSource, /disabled=\{[^}]*cloud/i);
});
