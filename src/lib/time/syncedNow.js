/**
 * syncedNow() - Shared Clock Time Function
 * 
 * Returns server-aligned time in milliseconds (Unix timestamp).
 * All clients using this function will have synchronized time.
 * 
 * Usage:
 *   const timestamp = syncedNow(); // Server-aligned time in ms
 *   const timestampSeconds = syncedNow() / 1000; // Server-aligned time in seconds
 * 
 * This matches Google Shared Piano's behavior where all clients
 * share the same time reference for scheduling notes.
 */

let clockSyncManager = null;

/**
 * Initialize syncedNow with a ClockSyncManager instance
 * Also exposes syncedNow globally for use in other modules
 * 
 * @param {ClockSyncManager} manager - ClockSyncManager instance
 */
export function initSyncedNow(manager) {
  clockSyncManager = manager;
  
  // Expose globally for use in clockSync.js (avoids circular dependency)
  if (typeof window !== 'undefined') {
    window.__syncedNow = syncedNow;
  }
}

/**
 * Get server-aligned time in milliseconds
 * 
 * Returns the current server time estimate, synchronized across all clients.
 * 
 * @returns {number} Server time in milliseconds (Unix timestamp)
 */
export function syncedNow() {
  if (!clockSyncManager) {
    // Fallback: return local time if sync not initialized
    console.warn('[syncedNow] ClockSyncManager not initialized, using local time');
    return Date.now();
  }

  return clockSyncManager.getSyncedTime();
}

/**
 * Get server-aligned time in seconds
 * 
 * @returns {number} Server time in seconds
 */
export function syncedNowSeconds() {
  return syncedNow() / 1000;
}

/**
 * Get current time offset
 * 
 * @returns {number} Time offset in milliseconds (serverTime - localTime)
 */
export function getTimeOffset() {
  if (!clockSyncManager) {
    return 0;
  }

  return clockSyncManager.getTimeOffset();
}

/**
 * Check if clock sync is active
 * 
 * @returns {boolean} True if sync is active
 */
export function isSynced() {
  return clockSyncManager !== null && clockSyncManager.isActive;
}

/**
 * Get sync statistics (for debugging)
 * 
 * @returns {Object|null} Stats object or null if not initialized
 */
export function getSyncStats() {
  if (!clockSyncManager) {
    return null;
  }

  return clockSyncManager.getStats();
}

