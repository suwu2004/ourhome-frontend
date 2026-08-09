import { Capacitor } from '@capacitor/core';

async function clearNativeOfflineShell() {
  if (typeof window === 'undefined' || !Capacitor.isNativePlatform()) return false;
  if ('serviceWorker' in navigator) {
    const registrations = await navigator.serviceWorker.getRegistrations().catch(() => []);
    await Promise.all(registrations.map(registration => registration.unregister().catch(() => false)));
  }
  if ('caches' in window) {
    const names = await caches.keys().catch(() => []);
    await Promise.all(names.filter(name => name.startsWith('ourhome-')).map(name => caches.delete(name)));
  }
  return true;
}

export function registerOfflineShell() {
  if (typeof window === 'undefined' || !('serviceWorker' in navigator)) return;
  if (Capacitor.isNativePlatform()) {
    clearNativeOfflineShell().catch(error => console.warn('[offline-shell] native cache cleanup failed:', error?.message || error));
    return;
  }
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
