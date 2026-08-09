import { Capacitor } from '@capacitor/core';

let deferredPrompt = null;
const listeners = new Set();

function installedDisplayMode() {
  return Capacitor.isNativePlatform()
    || window.matchMedia?.('(display-mode: standalone)').matches
    || window.navigator.standalone === true;
}

function snapshot() {
  return { native: Capacitor.isNativePlatform(), installed: installedDisplayMode(), promptAvailable: Boolean(deferredPrompt) };
}

function notify() {
  const value = snapshot();
  listeners.forEach(listener => listener(value));
}

export function initializeInstallExperience() {
  window.addEventListener('beforeinstallprompt', event => {
    event.preventDefault();
    deferredPrompt = event;
    notify();
  });
  window.addEventListener('appinstalled', () => {
    deferredPrompt = null;
    notify();
  });
  window.matchMedia?.('(display-mode: standalone)').addEventListener?.('change', notify);
  if (Capacitor.isNativePlatform()) document.documentElement.dataset.nativeApp = 'true';
}

export function subscribeInstallState(listener) {
  listeners.add(listener);
  listener(snapshot());
  return () => listeners.delete(listener);
}

export async function promptAppInstall() {
  if (!deferredPrompt) return { outcome: 'unavailable' };
  const prompt = deferredPrompt;
  deferredPrompt = null;
  await prompt.prompt();
  const choice = await prompt.userChoice;
  notify();
  return choice;
}
