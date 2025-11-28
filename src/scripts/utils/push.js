import { convertBase64ToUint8Array } from './index';
import { VAPID_PUBLIC_KEY } from '../config';

export function isPushSupported() {
  return 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window;
}

export async function registerServiceWorker() {
  try {
    // Preflight fetch to detect unbuilt service worker that contains bare ESM imports
    const resp = await fetch('/sw.js', { cache: 'no-store' });
    let text = '';
    if (resp && resp.ok) {
      text = await resp.text();
      // If the SW source contains bare imports (e.g. from 'workbox-...') it likely
      // hasn't been processed by the build (InjectManifest). Abort registration
      // in that case to avoid "Script evaluation failed" errors in dev.
      const hasBareImports = /from\s+['"][^\.\/].+['"]/m.test(text) || /import\s+\{/.test(text);
      if (hasBareImports) {
        const err = new Error('Service worker appears unbuilt (contains bare ESM imports). Build the project to generate a production-ready sw.js.');
        console.error('registerServiceWorker: aborted - unbuilt sw.js', err);
        throw err;
      }
    }

    const isImportScripts = /importScripts\s*\(/.test(text);
    let registration;
    if (isImportScripts) {
      registration = await navigator.serviceWorker.register('/sw.js');
    } else {
      registration = await navigator.serviceWorker.register('/sw.js', { type: 'module' });
    }
    return registration;
  } catch (error) {
    console.error('registerServiceWorker: error', error);
    throw error;
  }
}

export async function askNotificationPermission() {
  if (!('Notification' in window)) return 'denied';
  const permission = await Notification.requestPermission();
  return permission;
}

export async function getExistingSubscription() {
  const reg = await navigator.serviceWorker.getRegistration();
  if (!reg) return null;
  const sub = await reg.pushManager.getSubscription();
  return sub;
}

export async function subscribeUser() {
  try {
    const reg = await registerServiceWorker();
    const permission = await askNotificationPermission();
    if (permission !== 'granted') {
      throw new Error('Notification permission not granted');
    }

    const convertedVapidKey = convertBase64ToUint8Array(VAPID_PUBLIC_KEY);

    const subscription = await reg.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: convertedVapidKey,
    });

    return subscription;
  } catch (error) {
    console.error('subscribeUser: error', error);
    throw error;
  }
}

export async function unsubscribeUser() {
  try {
    const reg = await navigator.serviceWorker.getRegistration();
    if (!reg) return false;
    const sub = await reg.pushManager.getSubscription();
    if (!sub) return false;
    const unsub = await sub.unsubscribe();
    return unsub;
  } catch (error) {
    console.error('unsubscribeUser: error', error);
    throw error;
  }
}
