// Global cache layer for static/semi-static data
// Reduces API calls and improves performance

const CACHE_TTL = {
  USER_PROFILE: 5 * 60 * 1000, // 5 minutes
  DOCUMENT_METADATA: 2 * 60 * 1000, // 2 minutes
  GROUP_DATA: 3 * 60 * 1000, // 3 minutes
};

class CacheManager {
  constructor() {
    this.cache = new Map();
    this.timestamps = new Map();
  }

  set(key, value, ttl = 60000) {
    this.cache.set(key, value);
    this.timestamps.set(key, { createdAt: Date.now(), ttl });
  }

  get(key) {
    if (!this.cache.has(key)) return null;

    const timestamp = this.timestamps.get(key);
    if (!timestamp) return null;

    const age = Date.now() - timestamp.createdAt;
    if (age > timestamp.ttl) {
      this.delete(key);
      return null;
    }

    return this.cache.get(key);
  }

  delete(key) {
    this.cache.delete(key);
    this.timestamps.delete(key);
  }

  clear() {
    this.cache.clear();
    this.timestamps.clear();
  }

  cleanup() {
    const now = Date.now();
    for (const [key, timestamp] of this.timestamps.entries()) {
      if (now - timestamp.createdAt > timestamp.ttl) {
        this.delete(key);
      }
    }
  }
}

const globalCache = new CacheManager();

// Self-cleaning interval — cleared on page hide to prevent memory leaks in long sessions
const cleanupInterval = setInterval(() => globalCache.cleanup(), 2 * 60 * 1000);
if (typeof window !== 'undefined') {
  window.addEventListener('pagehide', () => clearInterval(cleanupInterval));
}

export const userProfileCache = {
  get(userId) {
    return globalCache.get(`user_profile_${userId}`);
  },

  set(userId, profile) {
    globalCache.set(`user_profile_${userId}`, profile, CACHE_TTL.USER_PROFILE);
  },

  getByEmail(email) {
    return globalCache.get(`user_profile_email_${email}`);
  },

  setByEmail(email, profile) {
    globalCache.set(`user_profile_email_${email}`, profile, CACHE_TTL.USER_PROFILE);
    if (profile.userId) {
      this.set(profile.userId, profile);
    }
  },

  invalidate(userId) {
    globalCache.delete(`user_profile_${userId}`);
  },

  invalidateByEmail(email) {
    globalCache.delete(`user_profile_email_${email}`);
  },

  invalidateAll() {
    for (const key of globalCache.cache.keys()) {
      if (key.startsWith('user_profile_')) {
        globalCache.delete(key);
      }
    }
  }
};

export const documentMetadataCache = {
  get(documentId) {
    return globalCache.get(`doc_meta_${documentId}`);
  },

  set(documentId, metadata) {
    globalCache.set(`doc_meta_${documentId}`, metadata, CACHE_TTL.DOCUMENT_METADATA);
  },

  invalidate(documentId) {
    globalCache.delete(`doc_meta_${documentId}`);
  },

  invalidateAll() {
    for (const key of globalCache.cache.keys()) {
      if (key.startsWith('doc_meta_')) {
        globalCache.delete(key);
      }
    }
  }
};

export const groupCache = {
  get(groupId) {
    return globalCache.get(`group_${groupId}`);
  },

  set(groupId, group) {
    globalCache.set(`group_${groupId}`, group, CACHE_TTL.GROUP_DATA);
  },

  invalidate(groupId) {
    globalCache.delete(`group_${groupId}`);
  },

  invalidateAll() {
    for (const key of globalCache.cache.keys()) {
      if (key.startsWith('group_')) {
        globalCache.delete(key);
      }
    }
  }
};

export default globalCache;