export function registerOfflineShell() {
  if (typeof window === 'undefined' || !('serviceWorker' in navigator)) return;
  if (window.location.protocol !== 'https:' && window.location.hostname !== 'localhost') return;

  const register = () => {
    navigator.serviceWorker.register('/ourhome-sw.js', { scope: '/' })
      .then(registration => {
        const announceWaiting = worker => {
          if (!worker || !navigator.serviceWorker.controller) return;
          window.dispatchEvent(new CustomEvent('ourhome-update-ready', { detail: { registration } }));
        };
        if (registration.waiting) announceWaiting(registration.waiting);
        registration.addEventListener('updatefound', () => {
          const worker = registration.installing;
          worker?.addEventListener('statechange', () => {
            if (worker.state === 'installed') announceWaiting(worker);
          });
        });
      })
      .catch(error => console.warn('[offline-shell] service worker unavailable:', error?.message || error));
  };

  if (document.readyState === 'complete') register();
  else window.addEventListener('load', register, { once: true });
}
