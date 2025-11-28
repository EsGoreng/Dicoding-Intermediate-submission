import { openDB } from 'idb';
import { BASE_URL } from '../config';

const DB_NAME = 'ceritadunia-sync-db';
const STORE_NAME = 'sync-queue';
const DB_VERSION = 1;

async function getDB() {
  return openDB(DB_NAME, DB_VERSION, {
    upgrade(db) {
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: 'id' });
      }
    },
  });
}

export async function enqueueStory({ description, photo, lat, lon, token }) {
  const db = await getDB();
  const id = `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
  // photo can be a File/Blob; idb can store blobs
  await db.put(STORE_NAME, {
    id,
    description,
    photo, // Blob
    lat,
    lon,
    token,
    createdAt: Date.now(),
  });

  // try to register background sync if available
  if ('serviceWorker' in navigator && 'SyncManager' in window) {
    try {
      const reg = await navigator.serviceWorker.ready;
      await reg.sync.register('sync-stories');
    } catch (err) {
      // ignore registration errors; we'll rely on online event
      // console.warn('Background sync register failed', err);
    }
  }

  return id;
}

export async function getAllQueued() {
  const db = await getDB();
  return db.getAll(STORE_NAME);
}

export async function removeQueued(id) {
  const db = await getDB();
  return db.delete(STORE_NAME, id);
}

async function sendItemToServer(item) {
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

    if (!res.ok) {
      // return false so caller knows this failed
      return false;
    }

    return true;
  } catch (err) {
    return false;
  }
}

export async function processQueue() {
  const items = await getAllQueued();
  for (const item of items) {
    const ok = await sendItemToServer(item);
    if (ok) {
      await removeQueued(item.id);
    }
  }
}

export function registerOnlineListener() {
  if (typeof window === 'undefined') return;
  window.addEventListener('online', async () => {
    try {
      await processQueue();
    } catch (err) {
      // ignore
    }
  });
}

export default {
  enqueueStory,
  getAllQueued,
  removeQueued,
  processQueue,
  registerOnlineListener,
};
