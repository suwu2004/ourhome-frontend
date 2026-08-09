import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { apiFetch, BACKEND, TOKEN_KEY } from './api.js';
import { applyDocumentTheme, DARK_THEME, getSavedDarkMode, LIGHT_THEME } from './theme.js';

const ThemeContext = createContext(null);
const BACKGROUND_SETTING_KEYS = [
  'bg_image_url',
  'home_bg_day_image_url',
  'home_bg_night_image_url',
  'home_memo_bg_image_url',
  'whisper_bg_image_url',
];
const ASSET_REFRESH_INTERVAL_MS = 6 * 60 * 60 * 1000;
const ASSET_RECOVERY_COOLDOWN_MS = 60 * 1000;

export function ThemeProvider({ children }) {
  const [darkMode, setDarkModeState] = useState(() => {
    const saved = getSavedDarkMode();
    applyDocumentTheme(saved);
    return saved;
  });
  const [settings, setSettings] = useState(null);
  const refreshPromiseRef = useRef(null);
  const lastRefreshAtRef = useRef(0);
  const lastAssetRecoveryAtRef = useRef(0);

  const setDarkMode = useCallback((next, { persist = true } = {}) => {
    const value = Boolean(next);
    setDarkModeState(value);
    setSettings(current => current && current.dark_mode !== value
      ? { ...current, dark_mode: value }
      : current);
    applyDocumentTheme(value);
    if (persist && localStorage.getItem(TOKEN_KEY)) {
      apiFetch(`${BACKEND}/settings`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ dark_mode: value }),
      }).catch(console.error);
    }
  }, []);

  const refreshTheme = useCallback(async ({ refreshAssets = false } = {}) => {
    if (!localStorage.getItem(TOKEN_KEY)) return null;

    const inFlight = refreshPromiseRef.current;
    if (inFlight) {
      if (!refreshAssets || inFlight.refreshAssets) return inFlight.promise;
      await inFlight.promise.catch(() => null);
    }

    const promise = (async () => {
      try {
        const response = await apiFetch(`${BACKEND}/settings`, {
          headers: refreshAssets ? { 'X-OurHome-Refresh-Assets': '1' } : undefined,
        });
        if (!response.ok) return null;
        const nextSettings = await response.json();
        lastRefreshAtRef.current = Date.now();
        setSettings(nextSettings);
        if (typeof nextSettings?.dark_mode === 'boolean') {
          setDarkMode(nextSettings.dark_mode, { persist: false });
        }
        return nextSettings;
      } catch (error) {
        console.error(error);
        return null;
      }
    })();

    const entry = { promise, refreshAssets };
    refreshPromiseRef.current = entry;
    try {
      return await promise;
    } finally {
      if (refreshPromiseRef.current === entry) refreshPromiseRef.current = null;
    }
  }, [setDarkMode]);

  useEffect(() => {
    refreshTheme();
    const handleAuthChanged = () => refreshTheme({ refreshAssets: true });
    window.addEventListener('ourhome-auth-changed', handleAuthChanged);
    return () => window.removeEventListener('ourhome-auth-changed', handleAuthChanged);
  }, [refreshTheme]);

  useEffect(() => {
    const urls = [...new Set(BACKGROUND_SETTING_KEYS.map(key => settings?.[key]).filter(Boolean))];
    if (!urls.length || typeof Image === 'undefined') return undefined;

    let cancelled = false;
    const images = urls.map(url => {
      const preload = new Image();
      preload.onerror = () => {
        if (cancelled) return;
        const now = Date.now();
        if (now - lastAssetRecoveryAtRef.current < ASSET_RECOVERY_COOLDOWN_MS) return;
        lastAssetRecoveryAtRef.current = now;
        refreshTheme({ refreshAssets: true });
      };
      preload.src = url;
      return preload;
    });

    return () => {
      cancelled = true;
      images.forEach(preload => {
        preload.onload = null;
        preload.onerror = null;
      });
    };
  }, [refreshTheme, settings]);

  useEffect(() => {
    const handleVisibility = () => {
      if (document.visibilityState !== 'visible') return;
      if (Date.now() - lastRefreshAtRef.current < ASSET_REFRESH_INTERVAL_MS) return;
      refreshTheme({ refreshAssets: true });
    };
    document.addEventListener('visibilitychange', handleVisibility);
    return () => document.removeEventListener('visibilitychange', handleVisibility);
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
