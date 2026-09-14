const axios = require('axios');
const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../../../.env') });
require('dotenv').config(); // Fallback

// Google OAuth2 & Drive Configuration
const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID || '';
const GOOGLE_CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET || '';
const GOOGLE_REFRESH_TOKEN = process.env.GOOGLE_REFRESH_TOKEN;
const GOOGLE_DRIVE_FOLDER_NAME = process.env.GOOGLE_DRIVE_FOLDER_NAME || 'GoogleDatabase_5TB_Storage';
const DB_FILE_NAME = 'nearwork_database_master.json';

/**
 * Calculates Haversine distance in kilometers between two GPS coordinates
 */
function haversineDistanceKm(lat1, lon1, lat2, lon2) {
  if (lat1 === undefined || lon1 === undefined || lat2 === undefined || lon2 === undefined) {
    return Infinity;
  }
  const R = 6371; // Earth radius in kilometers
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

class GoogleDriveSqlEngine {
  constructor() {
    this.accessToken = null;
    this.tokenExpiresAt = 0;
    this.rootFolderId = null;
    this.dbFileId = null;
    this.lastPullTime = 0;
    this.lastPushTime = 0;

    // Fast in-memory indexing maps for Near Work collections
    this.cache = {
      users: new Map(),
      services: new Map(),
      workers: new Map(),
      bookings: new Map()
    };

    this.isInitialized = false;
    this.syncPromise = null;
    this.pendingWrites = false;
    this.syncDebounceTimer = null;
  }

  /**
   * Obtain fresh Google OAuth2 Access Token using refresh token
   */
  async getAccessToken() {
    const now = Date.now();
    if (this.accessToken && this.tokenExpiresAt > now + 60000) {
      return this.accessToken;
    }

    try {
      const res = await axios.post(
        'https://oauth2.googleapis.com/token',
        {
          client_id: GOOGLE_CLIENT_ID,
          client_secret: GOOGLE_CLIENT_SECRET,
          refresh_token: GOOGLE_REFRESH_TOKEN,
          grant_type: 'refresh_token'
        },
        { timeout: 15000 }
      );

      this.accessToken = res.data.access_token;
      this.tokenExpiresAt = now + res.data.expires_in * 1000;
      return this.accessToken;
    } catch (err) {
      console.error(
        '[GoogleDriveSqlEngine] Failed to refresh OAuth token:',
        err.response?.data || err.message
      );
      throw new Error('Google Drive Authentication Failed: ' + (err.response?.data?.error_description || err.message));
    }
  }

  /**
   * Helper for Google Drive API HTTP requests
   */
  async driveRequest(method, url, data = null, params = {}, headers = {}) {
    const token = await this.getAccessToken();
    return axios({
      method,
      url,
      data,
      params,
      headers: {
        Authorization: `Bearer ${token}`,
        ...headers
      },
      timeout: 25000
    });
  }

  /**
   * Ensure Root Folder exists in Google Drive
   */
  async ensureRootFolder() {
    if (this.rootFolderId) return this.rootFolderId;

    try {
      const res = await this.driveRequest(
        'GET',
        'https://www.googleapis.com/drive/v3/files',
        null,
        {
          q: `name = '${GOOGLE_DRIVE_FOLDER_NAME}' and mimeType = 'application/vnd.google-apps.folder' and trashed = false`,
          fields: 'files(id, name)'
        }
      );

      if (res.data.files && res.data.files.length > 0) {
        this.rootFolderId = res.data.files[0].id;
      } else {
        const createRes = await this.driveRequest(
          'POST',
          'https://www.googleapis.com/drive/v3/files',
          {
            name: GOOGLE_DRIVE_FOLDER_NAME,
            mimeType: 'application/vnd.google-apps.folder'
          }
        );
        this.rootFolderId = createRes.data.id;
      }

      return this.rootFolderId;
    } catch (err) {
      console.error('[GoogleDriveSqlEngine] Error ensuring root folder:', err.message);
      return null;
    }
  }

  /**
   * Initialize / pull latest database snapshot from Google Drive
   * Uses 5000ms staleness guard to avoid redundant remote requests
   */
  async init(forceRefresh = false) {
    if (!forceRefresh && this.isInitialized && Date.now() - this.lastPullTime < 5000) {
      return;
    }

    try {
      const folderId = await this.ensureRootFolder();

      // Search for database file
      const q = folderId
        ? `name = '${DB_FILE_NAME}' and '${folderId}' in parents and trashed = false`
        : `name = '${DB_FILE_NAME}' and trashed = false`;

      const listRes = await this.driveRequest(
        'GET',
        'https://www.googleapis.com/drive/v3/files',
        null,
        {
          q,
          fields: 'files(id, name, modifiedTime)'
        }
      );

      if (listRes.data.files && listRes.data.files.length > 0) {
        this.dbFileId = listRes.data.files[0].id;

        // Download database content
        const dlRes = await this.driveRequest(
          'GET',
          `https://www.googleapis.com/drive/v3/files/${this.dbFileId}`,
          null,
          { alt: 'media' }
        );

        const snapshot =
          typeof dlRes.data === 'string' ? JSON.parse(dlRes.data) : dlRes.data;

        if (snapshot && typeof snapshot === 'object') {
          if (Array.isArray(snapshot.users)) {
            this.cache.users.clear();
            snapshot.users.forEach((u) => {
              if (u && (u.id || u._id)) {
                this.cache.users.set(u.id || u._id, u);
              }
            });
          }
          if (Array.isArray(snapshot.services)) {
            this.cache.services.clear();
            snapshot.services.forEach((s) => {
              if (s && (s.id || s._id)) {
                this.cache.services.set(s.id || s._id, s);
              }
            });
          }
          if (Array.isArray(snapshot.workers)) {
            this.cache.workers.clear();
            snapshot.workers.forEach((w) => {
              if (w && (w.id || w._id)) {
                this.cache.workers.set(w.id || w._id, w);
              }
            });
          }
          if (Array.isArray(snapshot.bookings)) {
            this.cache.bookings.clear();
            snapshot.bookings.forEach((b) => {
              if (b && (b.id || b._id)) {
                this.cache.bookings.set(b.id || b._id, b);
              }
            });
          }
        }
      } else {
        // Create initial database master file on Google Drive
        await this.syncToDriveImmediate();
      }

      this.isInitialized = true;
      this.lastPullTime = Date.now();
    } catch (err) {
      console.warn(
        '[GoogleDriveSqlEngine] Warning pulling DB from Drive, using current memory cache:',
        err.message
      );
      this.isInitialized = true;
    }
  }

  /**
   * Push complete memory database state directly into Google Drive
   */
  async syncToDriveImmediate() {
    try {
      const folderId = await this.ensureRootFolder();
      const payload = {
        version: '1.0.0',
        engine: 'NearWork Google 5TB Drive SQL Database Engine',
        databaseFile: DB_FILE_NAME,
        lastUpdated: new Date().toISOString(),
        users: Array.from(this.cache.users.values()),
        services: Array.from(this.cache.services.values()),
        workers: Array.from(this.cache.workers.values()),
        bookings: Array.from(this.cache.bookings.values())
      };

      const jsonStr = JSON.stringify(payload, null, 2);

      if (this.dbFileId) {
        // Update existing file
        await this.driveRequest(
          'PATCH',
          `https://www.googleapis.com/upload/drive/v3/files/${this.dbFileId}?uploadType=media`,
          jsonStr,
          {},
          { 'Content-Type': 'application/json' }
        );
      } else {
        // Create new file with metadata
        const metadata = {
          name: DB_FILE_NAME,
          parents: folderId ? [folderId] : undefined
        };

        const createRes = await this.driveRequest(
          'POST',
          'https://www.googleapis.com/drive/v3/files',
          metadata
        );
        this.dbFileId = createRes.data.id;

        await this.driveRequest(
          'PATCH',
          `https://www.googleapis.com/upload/drive/v3/files/${this.dbFileId}?uploadType=media`,
          jsonStr,
          {},
          { 'Content-Type': 'application/json' }
        );
      }

      this.lastPushTime = Date.now();
      this.pendingWrites = false;
      return {
        success: true,
        fileId: this.dbFileId,
        timestamp: payload.lastUpdated,
        counts: {
          users: payload.users.length,
          services: payload.services.length,
          workers: payload.workers.length,
          bookings: payload.bookings.length
        }
      };
    } catch (err) {
      console.error(
        '[GoogleDriveSqlEngine] Failed to sync DB to Google Drive:',
        err.response?.data || err.message
      );
      throw err;
    }
  }

  /**
   * Trigger debounced sync to coalescing rapid writes (100ms)
   */
  scheduleSync() {
    this.pendingWrites = true;
    if (this.syncDebounceTimer) {
      clearTimeout(this.syncDebounceTimer);
    }
    this.syncDebounceTimer = setTimeout(() => {
      this.syncToDriveImmediate().catch(console.error);
    }, 100);
  }

  // ==========================================
  // USERS CRUD OPERATIONS
  // ==========================================

  async getAllUsers() {
    await this.init();
    return Array.from(this.cache.users.values());
  }

  async getUserById(id) {
    await this.init();
    return this.cache.users.get(id) || null;
  }

  async getUserByEmail(email) {
    await this.init();
    const cleanEmail = (email || '').toLowerCase().trim();
    for (const u of this.cache.users.values()) {
      if (u.email && u.email.toLowerCase().trim() === cleanEmail) {
        return u;
      }
    }
    return null;
  }

  async getUserByPhone(phone) {
    await this.init();
    const clean = (phone || '').replace(/\D/g, '').slice(-10);
    if (!clean) return null;
    for (const u of this.cache.users.values()) {
      const uPhone = (u.phone || u.phoneNumber || '').replace(/\D/g, '').slice(-10);
      if (uPhone === clean) {
        return u;
      }
    }
    return null;
  }

  async saveUser(userData, immediate = true) {
    await this.init();
    const id = userData.id || userData._id || `usr_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
    const record = {
      ...userData,
      id,
      updatedAt: new Date().toISOString(),
      createdAt: userData.createdAt || new Date().toISOString()
    };
    this.cache.users.set(id, record);

    if (immediate) {
      await this.syncToDriveImmediate();
    } else {
      this.scheduleSync();
    }
    return record;
  }

  async createUser(userData, immediate = true) {
    return this.saveUser(userData, immediate);
  }

  async updateUser(id, partialData, immediate = true) {
    await this.init();
    const existing = this.cache.users.get(id);
    if (!existing) {
      throw new Error(`User with ID ${id} not found`);
    }
    const updated = {
      ...existing,
      ...partialData,
      id,
      updatedAt: new Date().toISOString()
    };
    this.cache.users.set(id, updated);

    if (immediate) {
      await this.syncToDriveImmediate();
    } else {
      this.scheduleSync();
    }
    return updated;
  }

  async deleteUser(id, immediate = true) {
    await this.init();
    const existed = this.cache.users.delete(id);
    if (existed) {
      if (immediate) {
        await this.syncToDriveImmediate();
      } else {
        this.scheduleSync();
      }
    }
    return { success: existed, id };
  }

  // ==========================================
  // SERVICES CRUD OPERATIONS
  // ==========================================

  async getAllServices() {
    await this.init();
    return Array.from(this.cache.services.values());
  }

  async getServiceById(id) {
    await this.init();
    return this.cache.services.get(id) || null;
  }

  async getServiceBySlug(slug) {
    await this.init();
    const cleanSlug = (slug || '').toLowerCase().trim();
    for (const s of this.cache.services.values()) {
      if (s.slug && s.slug.toLowerCase().trim() === cleanSlug) {
        return s;
      }
    }
    return null;
  }

  async saveService(serviceData, immediate = true) {
    await this.init();
    const id = serviceData.id || serviceData._id || `srv_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
    const record = {
      ...serviceData,
      id,
      updatedAt: new Date().toISOString(),
      createdAt: serviceData.createdAt || new Date().toISOString()
    };
    this.cache.services.set(id, record);

    if (immediate) {
      await this.syncToDriveImmediate();
    } else {
      this.scheduleSync();
    }
    return record;
  }

  async createService(serviceData, immediate = true) {
    return this.saveService(serviceData, immediate);
  }

  async updateService(id, partialData, immediate = true) {
    await this.init();
    const existing = this.cache.services.get(id);
    if (!existing) {
      throw new Error(`Service with ID ${id} not found`);
    }
    const updated = {
      ...existing,
      ...partialData,
      id,
      updatedAt: new Date().toISOString()
    };
    this.cache.services.set(id, updated);

    if (immediate) {
      await this.syncToDriveImmediate();
    } else {
      this.scheduleSync();
    }
    return updated;
  }

  async deleteService(id, immediate = true) {
    await this.init();
    const existed = this.cache.services.delete(id);
    if (existed) {
      if (immediate) {
        await this.syncToDriveImmediate();
      } else {
        this.scheduleSync();
      }
    }
    return { success: existed, id };
  }

  // ==========================================
  // WORKERS CRUD OPERATIONS
  // ==========================================

  async getAllWorkers() {
    await this.init();
    return Array.from(this.cache.workers.values());
  }

  async getWorkerById(id) {
    await this.init();
    return this.cache.workers.get(id) || null;
  }

  async getWorkerByUserId(userId) {
    await this.init();
    for (const w of this.cache.workers.values()) {
      if (w.userId === userId) {
        return w;
      }
    }
    return null;
  }

  async saveWorker(workerData, immediate = true) {
    await this.init();
    const id = workerData.id || workerData._id || `wrk_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
    const record = {
      ...workerData,
      id,
      updatedAt: new Date().toISOString(),
      createdAt: workerData.createdAt || new Date().toISOString()
    };
    this.cache.workers.set(id, record);

    if (immediate) {
      await this.syncToDriveImmediate();
    } else {
      this.scheduleSync();
    }
    return record;
  }

  async createWorker(workerData, immediate = true) {
    return this.saveWorker(workerData, immediate);
  }

  async updateWorker(id, partialData, immediate = true) {
    await this.init();
    const existing = this.cache.workers.get(id);
    if (!existing) {
      throw new Error(`Worker with ID ${id} not found`);
    }
    const updated = {
      ...existing,
      ...partialData,
      id,
      updatedAt: new Date().toISOString()
    };
    this.cache.workers.set(id, updated);

    if (immediate) {
      await this.syncToDriveImmediate();
    } else {
      this.scheduleSync();
    }
    return updated;
  }

  async deleteWorker(id, immediate = true) {
    await this.init();
    const existed = this.cache.workers.delete(id);
    if (existed) {
      if (immediate) {
        await this.syncToDriveImmediate();
      } else {
        this.scheduleSync();
      }
    }
    return { success: existed, id };
  }

  /**
   * M1 ↔ M2 Contract: Find registered workers within radius for a given service
   */
  async findWorkersByServiceAndRadius(serviceId, customerLat, customerLng, radiusKm = 15) {
    await this.init();
    const matchingWorkers = [];

    for (const worker of this.cache.workers.values()) {
      // Must not be offline
      if (worker.status === 'OFFLINE') continue;

      // Check skill / service capability if serviceId is provided
      if (serviceId && worker.skills && Array.isArray(worker.skills)) {
        const hasSkill = worker.skills.some(
          (s) => (typeof s === 'string' && s === serviceId) || (typeof s === 'object' && (s.serviceId === serviceId || s.id === serviceId))
        );
        if (!hasSkill && worker.skills.length > 0) continue;
      }

      // Check distance using Haversine calculation
      const wLat = worker.currentLat !== undefined ? Number(worker.currentLat) : undefined;
      const wLng = worker.currentLng !== undefined ? Number(worker.currentLng) : undefined;

      if (wLat !== undefined && wLng !== undefined && !isNaN(wLat) && !isNaN(wLng)) {
        const dist = haversineDistanceKm(customerLat, customerLng, wLat, wLng);
        const maxRadius = worker.workingRadiusKm ? Number(worker.workingRadiusKm) : radiusKm;

        if (dist <= maxRadius) {
          matchingWorkers.push({
            ...worker,
            distanceKm: Math.round(dist * 100) / 100
          });
        }
      } else {
        // Fallback for workers with no current coordinates but configured
        matchingWorkers.push({
          ...worker,
          distanceKm: null
        });
      }
    }

    // Sort by proximity ascending
    matchingWorkers.sort((a, b) => {
      if (a.distanceKm === null) return 1;
      if (b.distanceKm === null) return -1;
      return a.distanceKm - b.distanceKm;
    });

    return matchingWorkers;
  }

  // ==========================================
  // BOOKINGS CRUD OPERATIONS
  // ==========================================

  async getAllBookings() {
    await this.init();
    return Array.from(this.cache.bookings.values());
  }

  async getBookingById(id) {
    await this.init();
    return this.cache.bookings.get(id) || null;
  }

  async getBookingsByCustomer(customerId) {
    await this.init();
    const results = [];
    for (const b of this.cache.bookings.values()) {
      if (b.customerId === customerId || b.userId === customerId) {
        results.push(b);
      }
    }
    results.sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0));
    return results;
  }

  async getBookingsByWorker(workerId) {
    await this.init();
    const results = [];
    for (const b of this.cache.bookings.values()) {
      if (b.workerId === workerId) {
        results.push(b);
      }
    }
    results.sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0));
    return results;
  }

  async saveBooking(bookingData, immediate = true) {
    await this.init();
    const id = bookingData.id || bookingData._id || `bok_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
    const record = {
      ...bookingData,
      id,
      updatedAt: new Date().toISOString(),
      createdAt: bookingData.createdAt || new Date().toISOString()
    };
    this.cache.bookings.set(id, record);

    if (immediate) {
      await this.syncToDriveImmediate();
    } else {
      this.scheduleSync();
    }
    return record;
  }

  async createBooking(bookingData, immediate = true) {
    return this.saveBooking(bookingData, immediate);
  }

  async updateBooking(id, partialData, immediate = true) {
    await this.init();
    const existing = this.cache.bookings.get(id);
    if (!existing) {
      throw new Error(`Booking with ID ${id} not found`);
    }
    const updated = {
      ...existing,
      ...partialData,
      id,
      updatedAt: new Date().toISOString()
    };
    this.cache.bookings.set(id, updated);

    if (immediate) {
      await this.syncToDriveImmediate();
    } else {
      this.scheduleSync();
    }
    return updated;
  }

  async deleteBooking(id, immediate = true) {
    await this.init();
    const existed = this.cache.bookings.delete(id);
    if (existed) {
      if (immediate) {
        await this.syncToDriveImmediate();
      } else {
        this.scheduleSync();
      }
    }
    return { success: existed, id };
  }
}

// Export singleton instance and class
const googleDriveSqlEngine = new GoogleDriveSqlEngine();

module.exports = {
  GoogleDriveSqlEngine,
  googleDriveSqlEngine
};
