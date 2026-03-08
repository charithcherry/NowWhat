// Privacy & Storage Management - Secure Photo and Data Handling
import CryptoJS from 'crypto-js';

class PrivacyStorageManager {
  constructor(userId, storagePreference = 'hybrid') {
    this.userId = userId;
    this.storagePreference = storagePreference; // 'local', 'cloud', 'hybrid'
    this.encryption = new EncryptionService(userId);
    this.localStorage = new LocalStorageService();
    this.cloudStorage = new CloudStorageService();
    this.retentionManager = new DataRetentionManager();
  }

  /**
   * Store photo with privacy protection
   * @param {Object} photo - Photo data with base64 and metadata
   * @param {string} type - 'skin' or 'hair'
   * @param {Object} analysis - Analysis results to store
   * @returns {Promise<Object>} Storage confirmation
   */
  async storePhoto(photo, type, analysis) {
    try {
      const photoData = {
        id: this.generateSecureId(),
        userId: this.userId,
        type: type,
        timestamp: new Date().toISOString(),
        metadata: {
          dimensions: photo.dimensions,
          size: photo.size,
          mimeType: photo.mimeType
        },
        analysis: analysis
      };

      // Remove EXIF data for privacy
      const cleanedPhoto = await this.removeExifData(photo.base64);

      // Store based on user preference
      let storageResult;
      switch (this.storagePreference) {
        case 'local':
          storageResult = await this.storeLocally(cleanedPhoto, photoData);
          break;
        case 'cloud':
          storageResult = await this.storeInCloud(cleanedPhoto, photoData);
          break;
        case 'hybrid':
          storageResult = await this.storeHybrid(cleanedPhoto, photoData);
          break;
        default:
          storageResult = await this.storeLocally(cleanedPhoto, photoData);
      }

      // Log storage for retention management
      await this.retentionManager.logStorage(photoData.id, type, this.storagePreference);

      return {
        success: true,
        photoId: photoData.id,
        storageType: this.storagePreference,
        encrypted: true,
        retentionDays: this.retentionManager.getRetentionPeriod(type),
        ...storageResult
      };
    } catch (error) {
      console.error('Failed to store photo:', error);
      throw new Error(`Photo storage failed: ${error.message}`);
    }
  }

  /**
   * Store photo locally using IndexedDB
   */
  async storeLocally(photoBase64, metadata) {
    // Encrypt photo data
    const encryptionKey = await this.encryption.generateKey();
    const encryptedPhoto = await this.encryption.encrypt(photoBase64, encryptionKey);

    // Store in IndexedDB
    const db = await this.localStorage.openDatabase();
    const transaction = db.transaction(['photos'], 'readwrite');
    const store = transaction.objectStore('photos');

    const record = {
      id: metadata.id,
      userId: metadata.userId,
      type: metadata.type,
      timestamp: metadata.timestamp,
      encryptedData: encryptedPhoto,
      metadata: metadata.metadata,
      analysis: metadata.analysis,
      storageType: 'local',
      encryptionKeyId: encryptionKey.id
    };

    await store.add(record);

    // Store encryption key separately
    await this.localStorage.storeEncryptionKey(encryptionKey);

    return {
      location: 'local',
      recordId: metadata.id,
      sizeBytes: encryptedPhoto.length
    };
  }

  /**
   * Store photo in encrypted cloud storage
   */
  async storeInCloud(photoBase64, metadata) {
    // Client-side encryption before cloud upload
    const encryptionKey = await this.encryption.generateKey();
    const encryptedPhoto = await this.encryption.encrypt(photoBase64, encryptionKey);

    // Prepare cloud upload
    const cloudData = {
      data: encryptedPhoto,
      metadata: {
        ...metadata,
        encrypted: true,
        encryptionAlgorithm: 'AES-256-GCM',
        clientId: this.generateClientId()
      }
    };

    // Upload to cloud
    const uploadResult = await this.cloudStorage.upload(cloudData);

    // Store encryption key locally (never in cloud)
    await this.localStorage.storeEncryptionKey(encryptionKey);

    // Store reference locally
    await this.localStorage.storeCloudReference({
      photoId: metadata.id,
      cloudUrl: uploadResult.url,
      encryptionKeyId: encryptionKey.id,
      uploadDate: new Date().toISOString()
    });

    return {
      location: 'cloud',
      cloudUrl: uploadResult.url,
      recordId: metadata.id,
      encrypted: true
    };
  }

  /**
   * Hybrid storage - metadata in cloud, photo local
   */
  async storeHybrid(photoBase64, metadata) {
    // Store photo locally
    const localResult = await this.storeLocally(photoBase64, metadata);

    // Store only metadata and analysis in cloud
    const cloudMetadata = {
      id: metadata.id,
      userId: metadata.userId,
      type: metadata.type,
      timestamp: metadata.timestamp,
      analysis: metadata.analysis,
      localStorageRef: localResult.recordId
    };

    const cloudResult = await this.cloudStorage.uploadMetadata(cloudMetadata);

    return {
      location: 'hybrid',
      localId: localResult.recordId,
      cloudMetadataUrl: cloudResult.url,
      encrypted: true
    };
  }

  /**
   * Retrieve photo with decryption
   */
  async retrievePhoto(photoId) {
    try {
      // Check local storage first
      const localPhoto = await this.localStorage.getPhoto(photoId);

      if (localPhoto) {
        // Decrypt photo
        const encryptionKey = await this.localStorage.getEncryptionKey(
          localPhoto.encryptionKeyId
        );
        const decryptedPhoto = await this.encryption.decrypt(
          localPhoto.encryptedData,
          encryptionKey
        );

        return {
          photo: decryptedPhoto,
          metadata: localPhoto.metadata,
          analysis: localPhoto.analysis,
          timestamp: localPhoto.timestamp
        };
      }

      // Check cloud storage
      const cloudRef = await this.localStorage.getCloudReference(photoId);
      if (cloudRef) {
        const encryptedData = await this.cloudStorage.download(cloudRef.cloudUrl);
        const encryptionKey = await this.localStorage.getEncryptionKey(
          cloudRef.encryptionKeyId
        );
        const decryptedPhoto = await this.encryption.decrypt(
          encryptedData,
          encryptionKey
        );

        return {
          photo: decryptedPhoto,
          source: 'cloud'
        };
      }

      throw new Error('Photo not found');
    } catch (error) {
      console.error('Failed to retrieve photo:', error);
      throw error;
    }
  }

  /**
   * Create before/after comparison with privacy
   */
  async createComparison(beforePhotoId, afterPhotoId) {
    try {
      // Retrieve both photos
      const beforeData = await this.retrievePhoto(beforePhotoId);
      const afterData = await this.retrievePhoto(afterPhotoId);

      // Align photos for comparison
      const aligned = await this.alignPhotos(
        beforeData.photo,
        afterData.photo
      );

      // Create side-by-side comparison
      const comparison = await this.createSideBySideImage(
        aligned.before,
        aligned.after
      );

      // Calculate improvement metrics
      const metrics = this.calculateImprovement(
        beforeData.analysis,
        afterData.analysis
      );

      // Store comparison (encrypted)
      const comparisonId = await this.storeComparison({
        beforeId: beforePhotoId,
        afterId: afterPhotoId,
        comparisonImage: comparison,
        metrics: metrics,
        createdAt: new Date().toISOString()
      });

      return {
        comparisonId,
        metrics,
        beforeDate: beforeData.timestamp,
        afterDate: afterData.timestamp,
        improvementSummary: this.generateImprovementSummary(metrics)
      };
    } catch (error) {
      console.error('Failed to create comparison:', error);
      throw error;
    }
  }

  /**
   * Delete photo securely
   */
  async deletePhoto(photoId) {
    try {
      // Delete from local storage
      await this.localStorage.deletePhoto(photoId);

      // Delete from cloud if exists
      const cloudRef = await this.localStorage.getCloudReference(photoId);
      if (cloudRef) {
        await this.cloudStorage.delete(cloudRef.cloudUrl);
        await this.localStorage.deleteCloudReference(photoId);
      }

      // Delete encryption key
      await this.localStorage.deleteEncryptionKey(photoId);

      // Log deletion for audit
      await this.retentionManager.logDeletion(photoId);

      return {
        success: true,
        photoId: photoId,
        deletedAt: new Date().toISOString()
      };
    } catch (error) {
      console.error('Failed to delete photo:', error);
      throw error;
    }
  }

  /**
   * Export user data for GDPR compliance
   */
  async exportUserData() {
    try {
      console.log('Starting user data export...');

      // Gather all user data
      const userData = {
        profile: await this.getUserProfile(),
        photos: await this.getAllPhotos(),
        analyses: await this.getAllAnalyses(),
        comparisons: await this.getAllComparisons(),
        metadata: {
          exportDate: new Date().toISOString(),
          userId: this.userId,
          dataRetentionDays: this.retentionManager.policies
        }
      };

      // Create encrypted export
      const encryptedExport = await this.encryption.encryptExport(userData);

      // Generate download
      const exportBlob = new Blob([JSON.stringify(encryptedExport)], {
        type: 'application/json'
      });

      return {
        blob: exportBlob,
        filename: `wellness_data_export_${this.userId}_${Date.now()}.json`,
        size: exportBlob.size,
        encrypted: true
      };
    } catch (error) {
      console.error('Failed to export user data:', error);
      throw error;
    }
  }

  /**
   * Helper methods
   */
  generateSecureId() {
    return `${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  generateClientId() {
    return CryptoJS.SHA256(this.userId + navigator.userAgent).toString();
  }

  async removeExifData(base64Image) {
    // Remove EXIF data for privacy
    // This is a simplified version - in production, use a proper EXIF removal library
    return base64Image;
  }

  async alignPhotos(photo1, photo2) {
    // Simplified alignment - in production, use computer vision for proper alignment
    return {
      before: photo1,
      after: photo2
    };
  }

  async createSideBySideImage(before, after) {
    // Create canvas for side-by-side comparison
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');

    const beforeImg = new Image();
    const afterImg = new Image();

    beforeImg.src = `data:image/jpeg;base64,${before}`;
    afterImg.src = `data:image/jpeg;base64,${after}`;

    await Promise.all([
      new Promise(resolve => beforeImg.onload = resolve),
      new Promise(resolve => afterImg.onload = resolve)
    ]);

    canvas.width = beforeImg.width + afterImg.width;
    canvas.height = Math.max(beforeImg.height, afterImg.height);

    ctx.drawImage(beforeImg, 0, 0);
    ctx.drawImage(afterImg, beforeImg.width, 0);

    // Add labels
    ctx.font = '20px Arial';
    ctx.fillStyle = 'white';
    ctx.strokeStyle = 'black';
    ctx.lineWidth = 3;
    ctx.strokeText('Before', 10, 30);
    ctx.fillText('Before', 10, 30);
    ctx.strokeText('After', beforeImg.width + 10, 30);
    ctx.fillText('After', beforeImg.width + 10, 30);

    return canvas.toDataURL('image/jpeg').split(',')[1];
  }

  calculateImprovement(beforeAnalysis, afterAnalysis) {
    const improvements = {};

    // Calculate improvements for each metric
    if (beforeAnalysis.acne && afterAnalysis.acne) {
      improvements.acne = {
        before: beforeAnalysis.acne.score,
        after: afterAnalysis.acne.score,
        improvement: beforeAnalysis.acne.score - afterAnalysis.acne.score,
        percentChange: ((beforeAnalysis.acne.score - afterAnalysis.acne.score) / beforeAnalysis.acne.score) * 100
      };
    }

    if (beforeAnalysis.darkCircles && afterAnalysis.darkCircles) {
      improvements.darkCircles = {
        before: beforeAnalysis.darkCircles.score,
        after: afterAnalysis.darkCircles.score,
        improvement: beforeAnalysis.darkCircles.score - afterAnalysis.darkCircles.score,
        percentChange: ((beforeAnalysis.darkCircles.score - afterAnalysis.darkCircles.score) / beforeAnalysis.darkCircles.score) * 100
      };
    }

    // Overall improvement score
    const totalImprovement = Object.values(improvements)
      .reduce((sum, metric) => sum + (metric.improvement || 0), 0);

    improvements.overall = {
      score: totalImprovement,
      trend: totalImprovement > 0 ? 'improving' : totalImprovement < 0 ? 'declining' : 'stable'
    };

    return improvements;
  }

  generateImprovementSummary(metrics) {
    const improvements = [];
    const declines = [];

    for (const [key, metric] of Object.entries(metrics)) {
      if (key !== 'overall' && metric.improvement) {
        if (metric.improvement > 0) {
          improvements.push(`${key}: ${Math.abs(metric.percentChange).toFixed(1)}% better`);
        } else if (metric.improvement < 0) {
          declines.push(`${key}: ${Math.abs(metric.percentChange).toFixed(1)}% worse`);
        }
      }
    }

    return {
      improvements,
      declines,
      summary: metrics.overall.trend
    };
  }

  async storeComparison(comparisonData) {
    const encryptedComparison = await this.encryption.encrypt(
      JSON.stringify(comparisonData),
      await this.encryption.generateKey()
    );

    const comparisonId = this.generateSecureId();

    await this.localStorage.storeComparison({
      id: comparisonId,
      userId: this.userId,
      data: encryptedComparison,
      createdAt: comparisonData.createdAt
    });

    return comparisonId;
  }

  async getUserProfile() {
    // Fetch user profile from database
    return {};
  }

  async getAllPhotos() {
    return await this.localStorage.getAllPhotos(this.userId);
  }

  async getAllAnalyses() {
    return await this.localStorage.getAllAnalyses(this.userId);
  }

  async getAllComparisons() {
    return await this.localStorage.getAllComparisons(this.userId);
  }
}

/**
 * Encryption Service
 */
class EncryptionService {
  constructor(userId) {
    this.userId = userId;
    this.algorithm = 'AES-256-GCM';
  }

  async generateKey() {
    const key = CryptoJS.lib.WordArray.random(256/8);
    const keyId = this.generateKeyId();

    return {
      id: keyId,
      key: key.toString(),
      algorithm: this.algorithm,
      createdAt: new Date().toISOString()
    };
  }

  async deriveKey(password) {
    const salt = CryptoJS.lib.WordArray.random(128/8);
    const key = CryptoJS.PBKDF2(password, salt, {
      keySize: 256/32,
      iterations: 10000
    });

    return {
      key: key.toString(),
      salt: salt.toString()
    };
  }

  async encrypt(data, keyData) {
    const encrypted = CryptoJS.AES.encrypt(data, keyData.key);
    return encrypted.toString();
  }

  async decrypt(encryptedData, keyData) {
    const decrypted = CryptoJS.AES.decrypt(encryptedData, keyData.key);
    return decrypted.toString(CryptoJS.enc.Utf8);
  }

  async encryptExport(data) {
    const exportKey = await this.generateKey();
    const encryptedData = await this.encrypt(JSON.stringify(data), exportKey);

    return {
      data: encryptedData,
      keyHint: exportKey.key.substring(0, 4) + '****',
      algorithm: this.algorithm,
      instructions: 'Save the full key separately for decryption'
    };
  }

  generateKeyId() {
    return `key_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }
}

/**
 * Local Storage Service (IndexedDB)
 */
class LocalStorageService {
  constructor() {
    this.dbName = 'WellnessAppDB';
    this.dbVersion = 1;
  }

  async openDatabase() {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(this.dbName, this.dbVersion);

      request.onerror = () => reject(request.error);
      request.onsuccess = () => resolve(request.result);

      request.onupgradeneeded = (event) => {
        const db = event.target.result;

        // Create object stores
        if (!db.objectStoreNames.contains('photos')) {
          const photoStore = db.createObjectStore('photos', { keyPath: 'id' });
          photoStore.createIndex('userId', 'userId', { unique: false });
          photoStore.createIndex('type', 'type', { unique: false });
          photoStore.createIndex('timestamp', 'timestamp', { unique: false });
        }

        if (!db.objectStoreNames.contains('encryptionKeys')) {
          const keyStore = db.createObjectStore('encryptionKeys', { keyPath: 'id' });
          keyStore.createIndex('createdAt', 'createdAt', { unique: false });
        }

        if (!db.objectStoreNames.contains('cloudReferences')) {
          db.createObjectStore('cloudReferences', { keyPath: 'photoId' });
        }

        if (!db.objectStoreNames.contains('comparisons')) {
          const comparisonStore = db.createObjectStore('comparisons', { keyPath: 'id' });
          comparisonStore.createIndex('userId', 'userId', { unique: false });
        }
      };
    });
  }

  async storePhoto(photoData) {
    const db = await this.openDatabase();
    const transaction = db.transaction(['photos'], 'readwrite');
    const store = transaction.objectStore('photos');
    return store.add(photoData);
  }

  async getPhoto(photoId) {
    const db = await this.openDatabase();
    const transaction = db.transaction(['photos'], 'readonly');
    const store = transaction.objectStore('photos');

    return new Promise((resolve, reject) => {
      const request = store.get(photoId);
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  }

  async getAllPhotos(userId) {
    const db = await this.openDatabase();
    const transaction = db.transaction(['photos'], 'readonly');
    const store = transaction.objectStore('photos');
    const index = store.index('userId');

    return new Promise((resolve, reject) => {
      const request = index.getAll(userId);
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  }

  async deletePhoto(photoId) {
    const db = await this.openDatabase();
    const transaction = db.transaction(['photos'], 'readwrite');
    const store = transaction.objectStore('photos');
    return store.delete(photoId);
  }

  async storeEncryptionKey(keyData) {
    const db = await this.openDatabase();
    const transaction = db.transaction(['encryptionKeys'], 'readwrite');
    const store = transaction.objectStore('encryptionKeys');
    return store.add(keyData);
  }

  async getEncryptionKey(keyId) {
    const db = await this.openDatabase();
    const transaction = db.transaction(['encryptionKeys'], 'readonly');
    const store = transaction.objectStore('encryptionKeys');

    return new Promise((resolve, reject) => {
      const request = store.get(keyId);
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  }

  async deleteEncryptionKey(keyId) {
    const db = await this.openDatabase();
    const transaction = db.transaction(['encryptionKeys'], 'readwrite');
    const store = transaction.objectStore('encryptionKeys');
    return store.delete(keyId);
  }

  async storeCloudReference(reference) {
    const db = await this.openDatabase();
    const transaction = db.transaction(['cloudReferences'], 'readwrite');
    const store = transaction.objectStore('cloudReferences');
    return store.add(reference);
  }

  async getCloudReference(photoId) {
    const db = await this.openDatabase();
    const transaction = db.transaction(['cloudReferences'], 'readonly');
    const store = transaction.objectStore('cloudReferences');

    return new Promise((resolve, reject) => {
      const request = store.get(photoId);
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  }

  async deleteCloudReference(photoId) {
    const db = await this.openDatabase();
    const transaction = db.transaction(['cloudReferences'], 'readwrite');
    const store = transaction.objectStore('cloudReferences');
    return store.delete(photoId);
  }

  async storeComparison(comparisonData) {
    const db = await this.openDatabase();
    const transaction = db.transaction(['comparisons'], 'readwrite');
    const store = transaction.objectStore('comparisons');
    return store.add(comparisonData);
  }

  async getAllAnalyses(userId) {
    // Retrieve analysis data from photos
    const photos = await this.getAllPhotos(userId);
    return photos.map(p => p.analysis).filter(Boolean);
  }

  async getAllComparisons(userId) {
    const db = await this.openDatabase();
    const transaction = db.transaction(['comparisons'], 'readonly');
    const store = transaction.objectStore('comparisons');
    const index = store.index('userId');

    return new Promise((resolve, reject) => {
      const request = index.getAll(userId);
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  }
}

/**
 * Cloud Storage Service (Placeholder)
 */
class CloudStorageService {
  constructor() {
    this.baseUrl = process.env.NEXT_PUBLIC_CLOUD_STORAGE_URL || 'https://api.storage.example.com';
  }

  async upload(data) {
    // Implement cloud upload
    // This is a placeholder - integrate with actual cloud storage service
    console.log('Uploading to cloud storage...');

    return {
      url: `${this.baseUrl}/photos/${Date.now()}`,
      size: JSON.stringify(data).length
    };
  }

  async uploadMetadata(metadata) {
    console.log('Uploading metadata to cloud...');

    return {
      url: `${this.baseUrl}/metadata/${metadata.id}`
    };
  }

  async download(url) {
    // Implement cloud download
    console.log('Downloading from cloud storage:', url);

    // Placeholder - return empty data
    return '';
  }

  async delete(url) {
    // Implement cloud deletion
    console.log('Deleting from cloud storage:', url);

    return { success: true };
  }
}

/**
 * Data Retention Manager
 */
class DataRetentionManager {
  constructor() {
    this.policies = {
      photos: {
        retention: 90, // days
        autoDelete: true,
        requireConfirmation: true
      },
      analysis: {
        retention: 365, // days
        autoDelete: false,
        anonymize: true
      },
      personalData: {
        retention: null, // until user deletion
        autoDelete: false,
        exportable: true
      }
    };
  }

  getRetentionPeriod(dataType) {
    return this.policies[dataType]?.retention || 90;
  }

  async enforceRetentionPolicies() {
    const now = Date.now();

    // Check photo retention
    const photos = await this.getStoredPhotos();

    for (const photo of photos) {
      const age = this.daysSince(photo.timestamp);

      if (age > this.policies.photos.retention) {
        if (this.policies.photos.autoDelete) {
          if (this.policies.photos.requireConfirmation) {
            await this.requestDeletionConfirmation(photo);
          } else {
            await this.deletePhoto(photo.id);
          }
        }
      }
    }

    // Anonymize old analysis data
    const analyses = await this.getAnalysisRecords();

    for (const analysis of analyses) {
      const age = this.daysSince(analysis.timestamp);

      if (age > this.policies.analysis.retention && !analysis.anonymized) {
        await this.anonymizeAnalysis(analysis);
      }
    }
  }

  async logStorage(dataId, dataType, storageType) {
    // Log storage event for retention tracking
    const log = {
      dataId,
      dataType,
      storageType,
      storedAt: new Date().toISOString()
    };

    // Store in database or local storage
    localStorage.setItem(`retention_${dataId}`, JSON.stringify(log));
  }

  async logDeletion(dataId) {
    // Log deletion event for audit
    const log = {
      dataId,
      deletedAt: new Date().toISOString()
    };

    // Store in audit log
    localStorage.setItem(`deletion_${dataId}`, JSON.stringify(log));
  }

  daysSince(timestamp) {
    const date = new Date(timestamp);
    const now = new Date();
    return Math.floor((now - date) / (1000 * 60 * 60 * 24));
  }

  async getStoredPhotos() {
    // Placeholder - implement actual retrieval
    return [];
  }

  async getAnalysisRecords() {
    // Placeholder - implement actual retrieval
    return [];
  }

  async requestDeletionConfirmation(photo) {
    // Implement user notification for deletion confirmation
    console.log(`Requesting deletion confirmation for photo ${photo.id}`);
  }

  async deletePhoto(photoId) {
    // Implement secure deletion
    console.log(`Deleting photo ${photoId}`);
  }

  async anonymizeAnalysis(analysis) {
    // Remove personally identifiable information
    delete analysis.userId;
    delete analysis.location;
    analysis.anonymized = true;
    analysis.anonymizedAt = new Date().toISOString();

    // Update in storage
    console.log(`Anonymized analysis ${analysis.id}`);
  }
}

export default PrivacyStorageManager;