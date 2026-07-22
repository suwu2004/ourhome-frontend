export const HOME_WEATHER_CITY_KEY = 'ourhome_weather_city';
export const HOME_PREFERENCES_EVENT = 'ourhome-home-preferences-changed';

export function getHomeWeatherCity() {
  return localStorage.getItem(HOME_WEATHER_CITY_KEY)?.trim() || '';
}

export function saveHomeWeatherCity(city) {
  const normalized = String(city || '').trim().slice(0, 60);
  if (normalized) localStorage.setItem(HOME_WEATHER_CITY_KEY, normalized);
  else localStorage.removeItem(HOME_WEATHER_CITY_KEY);
  window.dispatchEvent(new CustomEvent(HOME_PREFERENCES_EVENT, { detail: { city: normalized } }));
  return normalized;
}
