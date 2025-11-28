import { openDB } from 'idb';

const DB_NAME = 'ceritadunia-db';
const STORE_NAME = 'saved-stories';
const DB_VERSION = 2;

async function getDB() {
  return openDB(DB_NAME, DB_VERSION, {
    upgrade(db) {
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: 'id' });
      }
      // Create cached-stories store for offline caching
      if (!db.objectStoreNames.contains('cached-stories')) {
        db.createObjectStore('cached-stories', { keyPath: 'id' });
      }
    },
  });
}

export async function saveStory(story) {
  const db = await getDB();
  await db.put(STORE_NAME, story);
  return true;
}

export async function removeStory(id) {
  const db = await getDB();
  await db.delete(STORE_NAME, id);
  return true;
}

export async function getStory(id) {
  const db = await getDB();
  return db.get(STORE_NAME, id);
}

export async function getAllSaved() {
  const db = await getDB();
  return db.getAll(STORE_NAME);
}

export async function isSaved(id) {
  const s = await getStory(id);
  return !!s;
}
