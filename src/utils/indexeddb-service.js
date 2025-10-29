// src/utils/indexeddb-service.js - Fixed Version
export class IndexedDBService {
  static DB_NAME = "ECommerceDB";
  static DB_VERSION = 5; // Increased version to force schema update
  static STORES = {
    PRODUCTS: "products",
    SYNC_QUEUE: "sync_queue",
    USER_DATA: "user_data",
  };

  static db = null;

  static async init() {
    return new Promise((resolve, reject) => {
      if (this.db) {
        resolve(this.db);
        return;
      }

      const request = indexedDB.open(this.DB_NAME, this.DB_VERSION);

      request.onerror = () => {
        console.error("IndexedDB error:", request.error);
        reject(request.error);
      };

      request.onsuccess = () => {
        this.db = request.result;
        console.log("IndexedDB initialized successfully");
        resolve(this.db);
      };

      request.onupgradeneeded = (event) => {
        const db = event.target.result;
        console.log(
          "IndexedDB upgrade needed, version:",
          event.oldVersion,
          "→",
          event.newVersion
        );
        this.createObjectStores(db, event.oldVersion);
      };
    });
  }

  static createObjectStores(db, oldVersion) {
    // Delete old stores if they exist (for clean migration)
    if (oldVersion > 0 && oldVersion < 5) {
      if (db.objectStoreNames.contains(this.STORES.PRODUCTS)) {
        db.deleteObjectStore(this.STORES.PRODUCTS);
      }
      if (db.objectStoreNames.contains(this.STORES.SYNC_QUEUE)) {
        db.deleteObjectStore(this.STORES.SYNC_QUEUE);
      }
      if (db.objectStoreNames.contains(this.STORES.USER_DATA)) {
        db.deleteObjectStore(this.STORES.USER_DATA);
      }
    }

    // Create products store
    if (!db.objectStoreNames.contains(this.STORES.PRODUCTS)) {
      const productStore = db.createObjectStore(this.STORES.PRODUCTS, {
        keyPath: "id",
        autoIncrement: true,
      });
      productStore.createIndex("createdAt", "createdAt", { unique: false });
      productStore.createIndex("synced", "synced", { unique: false });
      productStore.createIndex("local", "local", { unique: false });
      console.log("Created products store");
    }

    // Create sync queue store
    if (!db.objectStoreNames.contains(this.STORES.SYNC_QUEUE)) {
      const syncStore = db.createObjectStore(this.STORES.SYNC_QUEUE, {
        keyPath: "id",
        autoIncrement: true,
      });
      syncStore.createIndex("type", "type", { unique: false });
      syncStore.createIndex("timestamp", "timestamp", { unique: false });
      syncStore.createIndex("processed", "processed", { unique: false });
      console.log("Created sync queue store");
    }

    // Create user data store
    if (!db.objectStoreNames.contains(this.STORES.USER_DATA)) {
      const userStore = db.createObjectStore(this.STORES.USER_DATA, {
        keyPath: "key",
      });
      console.log("Created user data store");
    }
  }

  // PRODUCTS STORE OPERATIONS

  static async addProduct(productData) {
    await this.init();

    return new Promise((resolve, reject) => {
      const transaction = this.db.transaction(
        [this.STORES.PRODUCTS],
        "readwrite"
      );
      const store = transaction.objectStore(this.STORES.PRODUCTS);

      const product = {
        ...productData,
        id: `local_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        createdAt: new Date().toISOString(),
        synced: false,
        local: true,
        serverId: null,
      };

      const request = store.add(product);

      request.onsuccess = () => {
        console.log("Product added to IndexedDB with ID:", product.id);
        resolve(product.id);
      };

      request.onerror = () => {
        console.error("Error adding product to IndexedDB:", request.error);
        reject(request.error);
      };
    });
  }

  static async getAllProducts() {
    await this.init();

    return new Promise((resolve, reject) => {
      const transaction = this.db.transaction(
        [this.STORES.PRODUCTS],
        "readonly"
      );
      const store = transaction.objectStore(this.STORES.PRODUCTS);
      const request = store.getAll();

      request.onsuccess = () => {
        console.log(
          "Retrieved products from IndexedDB:",
          request.result.length
        );
        resolve(request.result);
      };

      request.onerror = () => {
        console.error(
          "Error retrieving products from IndexedDB:",
          request.error
        );
        reject(request.error);
      };
    });
  }

  static async getUnsyncedProducts() {
    await this.init();

    return new Promise((resolve, reject) => {
      const transaction = this.db.transaction(
        [this.STORES.PRODUCTS],
        "readonly"
      );
      const store = transaction.objectStore(this.STORES.PRODUCTS);
      const index = store.index("synced");

      // Use getAll with key range for boolean values
      const request = index.getAll(IDBKeyRange.only(false));

      request.onsuccess = () => {
        console.log("Retrieved unsynced products:", request.result.length);
        resolve(request.result);
      };

      request.onerror = () => {
        console.error("Error retrieving unsynced products:", request.error);
        reject(request.error);
      };
    });
  }

  static async getProduct(id) {
    await this.init();

    return new Promise((resolve, reject) => {
      const transaction = this.db.transaction(
        [this.STORES.PRODUCTS],
        "readonly"
      );
      const store = transaction.objectStore(this.STORES.PRODUCTS);
      const request = store.get(id);

      request.onsuccess = () => {
        resolve(request.result);
      };

      request.onerror = () => {
        console.error(
          "Error retrieving product from IndexedDB:",
          request.error
        );
        reject(request.error);
      };
    });
  }

  static async updateProduct(id, updates) {
    await this.init();

    return new Promise((resolve, reject) => {
      const transaction = this.db.transaction(
        [this.STORES.PRODUCTS],
        "readwrite"
      );
      const store = transaction.objectStore(this.STORES.PRODUCTS);

      const getRequest = store.get(id);

      getRequest.onsuccess = () => {
        const product = getRequest.result;
        if (!product) {
          reject(new Error("Product not found"));
          return;
        }

        const updatedProduct = {
          ...product,
          ...updates,
          updatedAt: new Date().toISOString(),
        };

        const putRequest = store.put(updatedProduct);

        putRequest.onsuccess = () => {
          console.log("Product updated in IndexedDB");
          resolve(putRequest.result);
        };

        putRequest.onerror = () => {
          console.error(
            "Error updating product in IndexedDB:",
            putRequest.error
          );
          reject(putRequest.error);
        };
      };

      getRequest.onerror = () => {
        console.error("Error getting product for update:", getRequest.error);
        reject(getRequest.error);
      };
    });
  }

  static async deleteProduct(id) {
    await this.init();

    return new Promise((resolve, reject) => {
      const transaction = this.db.transaction(
        [this.STORES.PRODUCTS],
        "readwrite"
      );
      const store = transaction.objectStore(this.STORES.PRODUCTS);
      const request = store.delete(id);

      request.onsuccess = () => {
        console.log("Product deleted from IndexedDB");
        resolve(true);
      };

      request.onerror = () => {
        console.error("Error deleting product from IndexedDB:", request.error);
        reject(request.error);
      };
    });
  }

  static async markProductAsSynced(localId, serverId) {
    return this.updateProduct(localId, {
      synced: true,
      serverId: serverId,
      syncedAt: new Date().toISOString(),
    });
  }

  // SYNC QUEUE OPERATIONS - FIXED VERSION

  static async addToSyncQueue(type, data) {
    await this.init();

    return new Promise((resolve, reject) => {
      const transaction = this.db.transaction(
        [this.STORES.SYNC_QUEUE],
        "readwrite"
      );
      const store = transaction.objectStore(this.STORES.SYNC_QUEUE);

      const syncItem = {
        type: type,
        data: data,
        timestamp: new Date().toISOString(),
        processed: false,
        attempts: 0,
      };

      const request = store.add(syncItem);

      request.onsuccess = () => {
        console.log("Added to sync queue:", type, "ID:", request.result);
        resolve(request.result);
      };

      request.onerror = () => {
        console.error("Error adding to sync queue:", request.error);
        reject(request.error);
      };
    });
  }

  static async getPendingSyncItems() {
    await this.init();

    return new Promise((resolve, reject) => {
      const transaction = this.db.transaction(
        [this.STORES.SYNC_QUEUE],
        "readonly"
      );
      const store = transaction.objectStore(this.STORES.SYNC_QUEUE);

      // Use getAll and filter manually instead of using index with boolean
      const request = store.getAll();

      request.onsuccess = () => {
        const allItems = request.result || [];
        const pendingItems = allItems.filter(
          (item) => item.processed === false
        );
        console.log("Retrieved pending sync items:", pendingItems.length);
        resolve(pendingItems);
      };

      request.onerror = () => {
        console.error("Error getting pending sync items:", request.error);
        reject(request.error);
      };
    });
  }

  static async markSyncItemAsProcessed(id) {
    await this.init();

    return new Promise((resolve, reject) => {
      const transaction = this.db.transaction(
        [this.STORES.SYNC_QUEUE],
        "readwrite"
      );
      const store = transaction.objectStore(this.STORES.SYNC_QUEUE);

      const getRequest = store.get(id);

      getRequest.onsuccess = () => {
        const item = getRequest.result;
        if (!item) {
          console.warn("Sync item not found for marking as processed:", id);
          resolve(false); // Resolve instead of reject for missing items
          return;
        }

        const updatedItem = {
          ...item,
          processed: true,
          processedAt: new Date().toISOString(),
        };

        const putRequest = store.put(updatedItem);

        putRequest.onsuccess = () => {
          console.log("Sync item marked as processed:", id);
          resolve(true);
        };

        putRequest.onerror = () => {
          console.error(
            "Error marking sync item as processed:",
            putRequest.error
          );
          reject(putRequest.error);
        };
      };

      getRequest.onerror = () => {
        console.error("Error getting sync item:", getRequest.error);
        reject(getRequest.error);
      };
    });
  }

  static async incrementSyncAttempts(id) {
    await this.init();

    return new Promise((resolve, reject) => {
      const transaction = this.db.transaction(
        [this.STORES.SYNC_QUEUE],
        "readwrite"
      );
      const store = transaction.objectStore(this.STORES.SYNC_QUEUE);

      const getRequest = store.get(id);

      getRequest.onsuccess = () => {
        const item = getRequest.result;
        if (!item) {
          console.warn("Sync item not found for incrementing attempts:", id);
          resolve(0);
          return;
        }

        const updatedItem = {
          ...item,
          attempts: (item.attempts || 0) + 1,
          lastAttempt: new Date().toISOString(),
        };

        const putRequest = store.put(updatedItem);

        putRequest.onsuccess = () => {
          console.log(
            "Sync attempts incremented for item:",
            id,
            "Attempts:",
            updatedItem.attempts
          );
          resolve(updatedItem.attempts);
        };

        putRequest.onerror = () => {
          console.error("Error incrementing sync attempts:", putRequest.error);
          reject(putRequest.error);
        };
      };

      getRequest.onerror = () => {
        console.error("Error getting sync item:", getRequest.error);
        reject(getRequest.error);
      };
    });
  }

  // USER DATA STORE OPERATIONS

  static async saveUserData(key, data) {
    await this.init();

    return new Promise((resolve, reject) => {
      const transaction = this.db.transaction(
        [this.STORES.USER_DATA],
        "readwrite"
      );
      const store = transaction.objectStore(this.STORES.USER_DATA);

      const userData = {
        key: key,
        data: data,
        updatedAt: new Date().toISOString(),
      };

      const request = store.put(userData);

      request.onsuccess = () => {
        console.log("User data saved:", key);
        resolve(true);
      };

      request.onerror = () => {
        console.error("Error saving user data:", request.error);
        reject(request.error);
      };
    });
  }

  static async getUserData(key) {
    await this.init();

    return new Promise((resolve, reject) => {
      const transaction = this.db.transaction(
        [this.STORES.USER_DATA],
        "readonly"
      );
      const store = transaction.objectStore(this.STORES.USER_DATA);
      const request = store.get(key);

      request.onsuccess = () => {
        const result = request.result ? request.result.data : null;
        resolve(result);
      };

      request.onerror = () => {
        console.error("Error retrieving user data:", request.error);
        reject(request.error);
      };
    });
  }

  static async deleteUserData(key) {
    await this.init();

    return new Promise((resolve, reject) => {
      const transaction = this.db.transaction(
        [this.STORES.USER_DATA],
        "readwrite"
      );
      const store = transaction.objectStore(this.STORES.USER_DATA);
      const request = store.delete(key);

      request.onsuccess = () => {
        console.log("User data deleted:", key);
        resolve(true);
      };

      request.onerror = () => {
        console.error("Error deleting user data:", request.error);
        reject(request.error);
      };
    });
  }

  // UTILITY METHODS

  static async getStats() {
    await this.init();

    try {
      const [products, syncItems, userData] = await Promise.all([
        this.getAllProducts(),
        this.getPendingSyncItems(),
        this.getUserData("app_settings"),
      ]);

      const syncedProducts = products.filter((p) => p.synced).length;
      const localProducts = products.filter((p) => !p.synced).length;

      const stats = {
        totalProducts: products.length,
        syncedProducts: syncedProducts,
        localProducts: localProducts,
        pendingSync: syncItems.length,
        lastSync: await this.getUserData("last_sync_time"),
        appSettings: userData,
      };

      return stats;
    } catch (error) {
      console.error("Error getting stats:", error);
      return {
        totalProducts: 0,
        syncedProducts: 0,
        localProducts: 0,
        pendingSync: 0,
        lastSync: null,
        appSettings: null,
      };
    }
  }

  static async clearAllData() {
    await this.init();

    return new Promise((resolve, reject) => {
      const transaction = this.db.transaction(
        [this.STORES.PRODUCTS, this.STORES.SYNC_QUEUE, this.STORES.USER_DATA],
        "readwrite"
      );

      let completed = 0;
      const totalStores = 3;

      const checkCompletion = () => {
        completed++;
        if (completed === totalStores) {
          console.log("All IndexedDB data cleared");
          resolve(true);
        }
      };

      transaction.objectStore(this.STORES.PRODUCTS).clear().onsuccess =
        checkCompletion;
      transaction.objectStore(this.STORES.SYNC_QUEUE).clear().onsuccess =
        checkCompletion;
      transaction.objectStore(this.STORES.USER_DATA).clear().onsuccess =
        checkCompletion;

      transaction.onerror = () => {
        console.error("Error clearing IndexedDB data:", transaction.error);
        reject(transaction.error);
      };
    });
  }

  static async exportData() {
    await this.init();

    const [products, syncItems, userData] = await Promise.all([
      this.getAllProducts(),
      this.getPendingSyncItems(),
      this.getUserData("app_settings"),
    ]);

    return {
      products: products || [],
      syncQueue: syncItems || [],
      userData: userData || null,
      exportDate: new Date().toISOString(),
      version: this.DB_VERSION,
    };
  }

  static async importData(data) {
    if (!data) {
      throw new Error("No data provided for import");
    }

    await this.clearAllData();

    if (data.products && Array.isArray(data.products)) {
      for (const product of data.products) {
        await this.addProduct(product);
      }
    }

    if (data.syncQueue && Array.isArray(data.syncQueue)) {
      for (const item of data.syncQueue) {
        await this.addToSyncQueue(item.type, item.data);
      }
    }

    if (data.userData) {
      await this.saveUserData("app_settings", data.userData);
    }

    console.log("Data imported successfully");
    return true;
  }

  // Check if IndexedDB is supported
  static isSupported() {
    return "indexedDB" in window;
  }

  // Get database size (approximate)
  static async getDatabaseSize() {
    if (!this.db) return 0;

    let totalSize = 0;
    const storeNames = Array.from(this.db.objectStoreNames);

    for (const storeName of storeNames) {
      const transaction = this.db.transaction([storeName], "readonly");
      const store = transaction.objectStore(storeName);
      const request = store.getAll();

      await new Promise((resolve) => {
        request.onsuccess = () => {
          const data = request.result;
          totalSize += new Blob([JSON.stringify(data)]).size;
          resolve();
        };
        request.onerror = resolve; // Ignore errors for size calculation
      });
    }

    return totalSize;
  }

  // Clear old processed sync items (cleanup)
  static async cleanupOldSyncItems(daysOld = 7) {
    await this.init();

    return new Promise((resolve, reject) => {
      const transaction = this.db.transaction(
        [this.STORES.SYNC_QUEUE],
        "readwrite"
      );
      const store = transaction.objectStore(this.STORES.SYNC_QUEUE);
      const request = store.getAll();

      request.onsuccess = () => {
        const cutoffDate = new Date();
        cutoffDate.setDate(cutoffDate.getDate() - daysOld);

        const items = request.result || [];
        let deletedCount = 0;

        items.forEach((item) => {
          if (item.processed && new Date(item.processedAt) < cutoffDate) {
            store.delete(item.id);
            deletedCount++;
          }
        });

        console.log(`Cleaned up ${deletedCount} old sync items`);
        resolve(deletedCount);
      };

      request.onerror = () => {
        console.error("Error during cleanup:", request.error);
        reject(request.error);
      };
    });
  }
}

// Auto-initialize when imported
IndexedDBService.init().catch((error) => {
  console.error("Failed to initialize IndexedDB:", error);
});
