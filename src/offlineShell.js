export function registerOfflineShell() {
  if (typeof window === 'undefined' || !('serviceWorker' in navigator)) return;
  if (window.location.protocol !== 'https:' && window.location.hostname !== 'localhost') return;

  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/ourhome-sw.js', { scope: '/' })
      .catch(error => console.warn('[offline-shell] service worker unavailable:', error?.message || error));
  }, { once: true });
}
