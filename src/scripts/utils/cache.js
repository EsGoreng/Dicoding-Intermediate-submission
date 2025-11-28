import { openDB } from 'idb';

const DB_NAME = 'ceritadunia-db';
const CACHE_STORE_NAME = 'cached-stories';
const DB_VERSION = 2;

async function getDB() {
  return openDB(DB_NAME, DB_VERSION, {
    upgrade(db) {
      // Create saved-stories store (for bookmarks)
      if (!db.objectStoreNames.contains('saved-stories')) {
        db.createObjectStore('saved-stories', { keyPath: 'id' });
      }

      // Create cached-stories store for offline caching
      if (!db.objectStoreNames.contains(CACHE_STORE_NAME)) {
        db.createObjectStore(CACHE_STORE_NAME, { keyPath: 'id' });
      }
    },
  });
}

/**
 * Cache cerita terbaru untuk offline access
 */
export async function cacheStories(stories = []) {
  try {
    const db = await getDB();
    const tx = db.transaction(CACHE_STORE_NAME, 'readwrite');

    // Clear existing cache first
    await tx.objectStore(CACHE_STORE_NAME).clear();

    // Add each story
    for (const story of stories) {
      await tx.objectStore(CACHE_STORE_NAME).put({
        ...story,
        cachedAt: new Date().toISOString(),
      });
    }

    await tx.done;
    return true;
  } catch (error) {
    console.error('cacheStories error:', error);
    return false;
  }
}

/**
 * Get cached stories for offline access
 */
export async function getCachedStories() {
  try {
    const db = await getDB();
    const stories = await db.getAll(CACHE_STORE_NAME);
    return stories || [];
  } catch (error) {
    console.error('getCachedStories error:', error);
    return [];
  }
}

/**
 * Check if stories exist in cache
 */
export async function hasCachedStories() {
  try {
    const db = await getDB();
    const count = await db.count(CACHE_STORE_NAME);
    return count > 0;
  } catch (error) {
    console.error('hasCachedStories error:', error);
    return false;
  }
}

/**
 * Clear cached stories
 */
export async function clearCachedStories() {
  try {
    const db = await getDB();
    await db.clear(CACHE_STORE_NAME);
    return true;
  } catch (error) {
    console.error('clearCachedStories error:', error);
    return false;
  }
}
