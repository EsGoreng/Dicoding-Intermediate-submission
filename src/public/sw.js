// Workbox precache placeholder - InjectManifest will replace self.__WB_MANIFEST
import { precacheAndRoute, createHandlerBoundToURL } from 'workbox-precaching';
import { registerRoute } from 'workbox-routing';
import { CacheFirst, NetworkFirst, StaleWhileRevalidate } from 'workbox-strategies';
import { ExpirationPlugin } from 'workbox-expiration';
import { CacheableResponsePlugin } from 'workbox-cacheable-response';
import { openDB } from 'idb';
import { BASE_URL } from '../scripts/config';

precacheAndRoute(self.__WB_MANIFEST || []);

/**
 * Runtime caching rules (Workbox)
 * - Google Font
 *   -> CacheFirst (fonts.googleapis.com, fonts.gstatic.com)
 * - Font Awesome (cdnjs)
 *   -> CacheFirst
 * - UI Avatars icons
 *   -> CacheFirst (only cache responses with status 0 or 200)
 * - JSON from APIs
 *   -> NetworkFirst (ensure fresh data)
 * - Images from APIs
 *   -> StaleWhileRevalidate (serve from cache first, update in background)
 * - MapTiler reverse geocoding
 *   -> CacheFirst
 */

// Google Fonts stylesheets
registerRoute(
  ({ url }) => url.origin === 'https://fonts.googleapis.com',
  new CacheFirst({
    cacheName: 'google-fonts-stylesheets',
    plugins: [new ExpirationPlugin({ maxEntries: 20, maxAgeSeconds: 60 * 60 * 24 * 365 })],
  }),
);
// Google Fonts webfonts
registerRoute(
  ({ url }) => url.origin === 'https://fonts.gstatic.com',
  new CacheFirst({
    cacheName: 'google-fonts-webfonts',
    plugins: [
      new CacheableResponsePlugin({ statuses: [0, 200] }),
      new ExpirationPlugin({ maxEntries: 30, maxAgeSeconds: 60 * 60 * 24 * 365 }),
    ],
  }),
);

// Font Awesome (CDN)
registerRoute(
  ({ url }) =>
    url.hostname.includes('cdnjs.cloudflare.com') && url.pathname.includes('font-awesome'),
  new CacheFirst({
    cacheName: 'font-awesome-cdn',
    plugins: [new ExpirationPlugin({ maxEntries: 20, maxAgeSeconds: 60 * 60 * 24 * 365 })],
  }),
);

// UI Avatars icons - cache responses only when status 0 or 200
registerRoute(
  ({ url }) => url.hostname.includes('ui-avatars.com'),
  new CacheFirst({
    cacheName: 'ui-avatars',
    plugins: [
      new CacheableResponsePlugin({ statuses: [0, 200] }),
      new ExpirationPlugin({ maxEntries: 60, maxAgeSeconds: 60 * 60 * 24 * 30 }),
    ],
  }),
);

// JSON responses (NetworkFirst) - matching application/json or .json or /api/ paths
registerRoute(
  ({ request, url }) => {
    try {
      const accept = request.headers.get('accept') || '';
      if (accept.includes('application/json')) return true;
    } catch (e) {
      // ignore
    }
    if (url.pathname.endsWith('.json')) return true;
    if (url.pathname.includes('/api/')) return true;
    return false;
  },
  new NetworkFirst({
    cacheName: 'api-json',
    plugins: [
      new CacheableResponsePlugin({ statuses: [0, 200] }),
      new ExpirationPlugin({ maxEntries: 60, maxAgeSeconds: 60 * 60 * 24 }),
    ],
  }),
);

// App shell: serve index.html for navigation requests so SPA routes work offline
registerRoute(({ request }) => request.mode === 'navigate', createHandlerBoundToURL('/index.html'));

// Images from APIs - StaleWhileRevalidate
registerRoute(
  ({ request, url }) => {
    if (request.destination === 'image') {
      if (
        url.pathname.includes('/images') ||
        url.pathname.includes('/uploads') ||
        url.pathname.includes('/media')
      ) {
        return true;
      }
      if (url.hostname && url.hostname.includes('citycare')) return true;
    }
    return false;
  },
  new StaleWhileRevalidate({
    cacheName: 'api-images',
    plugins: [new ExpirationPlugin({ maxEntries: 100, maxAgeSeconds: 60 * 60 * 24 * 30 })],
  }),
);

// MapTiler reverse geocoding - CacheFirst
registerRoute(
  ({ url }) =>
    url.hostname.includes('maptiler') && url.pathname.toLowerCase().includes('geocoding'),
  new CacheFirst({
    cacheName: 'maptiler-geocoding',
    plugins: [
      new CacheableResponsePlugin({ statuses: [0, 200] }),
      new ExpirationPlugin({ maxEntries: 50, maxAgeSeconds: 60 * 60 * 24 * 365 }),
    ],
  }),
);

self.addEventListener('push', function (event) {
  let payload = {};
  try {
    if (event.data) {
      payload = event.data.json();
    }
  } catch (e) {
    payload = {
      title: 'Notifikasi',
      options: { body: event.data ? event.data.text() : 'Ada notifikasi baru' },
    };
  }

  const title = payload.title || 'CeritaDunia';
  const options = payload.options || {};

  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener('notificationclick', function (event) {
  event.notification.close();
  const urlToOpen = new URL('/', self.location.origin).href;

  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      for (const client of clientList) {
        if (client.url === urlToOpen && 'focus' in client) {
          return client.focus();
        }
      }
      if (clients.openWindow) {
        return clients.openWindow(urlToOpen);
      }
    }),
  );
});

// Background sync: process queued stories stored in IndexedDB (ceritadunia-sync-db)
const SYNC_DB = 'ceritadunia-sync-db';
const SYNC_STORE = 'sync-queue';

async function getSyncDB() {
  return openDB(SYNC_DB, 1, {
    upgrade(db) {
      if (!db.objectStoreNames.contains(SYNC_STORE)) {
        db.createObjectStore(SYNC_STORE, { keyPath: 'id' });
      }
    },
  });
}

async function getAllSyncItems() {
  const db = await getSyncDB();
  return db.getAll(SYNC_STORE);
}

async function removeSyncItem(id) {
  const db = await getSyncDB();
  return db.delete(SYNC_STORE, id);
}

async function sendQueuedItem(item) {
  try {
    const formData = new FormData();
    formData.append('description', item.description || '');
    if (item.photo) formData.append('photo', item.photo, 'photo.jpg');
    if (item.lat !== undefined) formData.append('lat', item.lat);
    if (item.lon !== undefined) formData.append('lon', item.lon);

    const res = await fetch(`${BASE_URL}/stories`, {
      method: 'POST',
      headers: item.token ? { Authorization: `Bearer ${item.token}` } : {},
      body: formData,
    });

    return res.ok;
  } catch (err) {
    return false;
  }
}

self.addEventListener('sync', function (event) {
  if (event.tag === 'sync-stories') {
    event.waitUntil(
      (async () => {
        const items = await getAllSyncItems();
        for (const item of items) {
          const ok = await sendQueuedItem(item);
          if (ok) {
            await removeSyncItem(item.id);
          }
        }
      })(),
    );
  }
});
