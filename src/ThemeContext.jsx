import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { apiFetch, BACKEND, TOKEN_KEY } from './api.js';
import { applyDocumentTheme, DARK_THEME, getSavedDarkMode, LIGHT_THEME } from './theme.js';

const ThemeContext = createContext(null);

export function ThemeProvider({ children }) {
  const [darkMode, setDarkModeState] = useState(() => {
    const saved = getSavedDarkMode();
    applyDocumentTheme(saved);
    return saved;
  });
  const [settings, setSettings] = useState(null);

  const setDarkMode = useCallback((next, { persist = true } = {}) => {
    const value = Boolean(next);
    setDarkModeState(value);
    setSettings(current => current ? { ...current, dark_mode: value } : current);
    applyDocumentTheme(value);
    if (persist && localStorage.getItem(TOKEN_KEY)) {
      apiFetch(`${BACKEND}/settings`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ dark_mode: value }),
      }).catch(console.error);
    }
  }, []);

  const refreshTheme = useCallback(async () => {
    if (!localStorage.getItem(TOKEN_KEY)) return;
    try {
      const response = await apiFetch(`${BACKEND}/settings`);
      if (!response.ok) return;
      const settings = await response.json();
      setSettings(settings);
      if (typeof settings?.dark_mode === 'boolean') setDarkMode(settings.dark_mode, { persist: false });
    } catch (error) {
      console.error(error);
    }
  }, [setDarkMode]);

  useEffect(() => {
    refreshTheme();
    window.addEventListener('ourhome-auth-changed', refreshTheme);
    return () => window.removeEventListener('ourhome-auth-changed', refreshTheme);
  }, [refreshTheme]);

  const toggleDarkMode = useCallback(() => setDarkMode(!darkMode), [darkMode, setDarkMode]);
  const value = useMemo(() => ({
    darkMode,
    theme: darkMode ? DARK_THEME : LIGHT_THEME,
    settings,
    setDarkMode,
    toggleDarkMode,
    refreshTheme,
  }), [darkMode, refreshTheme, setDarkMode, settings, toggleDarkMode]);

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme() {
  const value = useContext(ThemeContext);
  if (!value) throw new Error('useTheme 必须在 ThemeProvider 内使用');
  return value;
}
