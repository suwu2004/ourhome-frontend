export function registerOfflineShell() {
  if (typeof window === 'undefined' || !('serviceWorker' in navigator)) return;
  if (window.location.protocol !== 'https:' && window.location.hostname !== 'localhost') return;

  const register = () => {
    navigator.serviceWorker.register('/ourhome-sw.js', { scope: '/' })
      .catch(error => console.warn('[offline-shell] service worker unavailable:', error?.message || error));
  };

  if (document.readyState === 'complete') register();
  else window.addEventListener('load', register, { once: true });
}
