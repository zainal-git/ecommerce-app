// src/utils/sync-service.js - Fixed Version
import { IndexedDBService } from "./indexeddb-service.js";
import { ApiService } from "../config/api.js";
import { AuthService } from "./auth.js";

export class SyncService {
  static isSyncing = false;
  static syncInterval = null;
  static lastSyncTime = null;
  static syncListeners = new Set();

  static async init() {
    if (!IndexedDBService.isSupported()) {
      console.warn("IndexedDB is not supported in this browser");
      return;
    }

    try {
      // Initialize IndexedDB
      await IndexedDBService.init();

      // Load last sync time
      this.lastSyncTime = await IndexedDBService.getUserData("last_sync_time");

      // Start periodic sync
      this.startPeriodicSync();

      // Sync when coming online
      window.addEventListener("online", () => {
        console.log("Device online - starting sync");
        this.syncOfflineData();
      });

      // Sync when visibility changes (tab becomes active)
      document.addEventListener("visibilitychange", () => {
        if (!document.hidden && navigator.onLine) {
          this.syncOfflineData();
        }
      });

      console.log("Sync Service initialized successfully");
    } catch (error) {
      console.error("Failed to initialize Sync Service:", error);
    }
  }

  static startPeriodicSync() {
    // Clear existing interval
    if (this.syncInterval) {
      clearInterval(this.syncInterval);
    }

    // Sync every 2 minutes when online
    this.syncInterval = setInterval(() => {
      if (navigator.onLine && !this.isSyncing) {
        this.syncOfflineData();
      }
    }, 2 * 60 * 1000); // 2 minutes
  }

  static stopPeriodicSync() {
    if (this.syncInterval) {
      clearInterval(this.syncInterval);
      this.syncInterval = null;
    }
  }

  static async syncOfflineData() {
    if (this.isSyncing || !navigator.onLine) {
      console.log("Sync skipped - already syncing or offline");
      return;
    }

    this.isSyncing = true;
    this.notifyListeners("sync_started");

    console.log("Starting offline data sync...");

    try {
      // Sync pending items first
      await this.syncPendingItems();

      // Then sync local products
      await this.syncLocalProducts();

      // Update last sync time
      this.lastSyncTime = new Date().toISOString();
      await IndexedDBService.saveUserData("last_sync_time", this.lastSyncTime);

      console.log("Offline data sync completed successfully");
      this.notifyListeners("sync_completed", { success: true });
    } catch (error) {
      console.error("Sync failed:", error);
      this.notifyListeners("sync_failed", { error: error.message });
    } finally {
      this.isSyncing = false;
    }
  }

  static async syncPendingItems() {
    try {
      const pendingItems = await IndexedDBService.getPendingSyncItems();
      console.log(`Found ${pendingItems.length} pending sync items`);

      for (const item of pendingItems) {
        try {
          await this.processSyncItem(item);
          await IndexedDBService.markSyncItemAsProcessed(item.id);
          console.log(`Successfully synced item: ${item.type}`, item.id);
        } catch (error) {
          console.error(`Failed to sync item ${item.id}:`, error);

          // Increment attempt count
          const attempts = await IndexedDBService.incrementSyncAttempts(
            item.id
          );

          // If too many attempts, mark as failed
          if (attempts >= 3) {
            await IndexedDBService.markSyncItemAsProcessed(item.id);
            console.warn(
              `Sync item ${item.id} failed after ${attempts} attempts`
            );
          }
        }
      }
    } catch (error) {
      console.error("Error in syncPendingItems:", error);
      throw error;
    }
  }

  static async syncLocalProducts() {
    try {
      const localProducts = await IndexedDBService.getUnsyncedProducts();
      console.log(`Found ${localProducts.length} local products to sync`);

      for (const product of localProducts) {
        try {
          await this.syncProductToServer(product);
          console.log(`Successfully synced product: ${product.id}`);
        } catch (error) {
          console.error(`Failed to sync product ${product.id}:`, error);
        }
      }
    } catch (error) {
      console.error("Error in syncLocalProducts:", error);
      // Don't throw here, continue with other operations
    }
  }

  static async processSyncItem(item) {
    const token = AuthService.getToken();
    if (!token) {
      throw new Error("No authentication token available");
    }

    switch (item.type) {
      case "ADD_PRODUCT":
        await this.syncProductToServer(item.data);
        break;

      case "UPDATE_PRODUCT":
        // Implement update logic if needed
        console.log("Update product sync:", item.data);
        break;

      case "DELETE_PRODUCT":
        // Implement delete logic if needed
        console.log("Delete product sync:", item.data);
        break;

      default:
        console.warn("Unknown sync item type:", item.type);
    }
  }

  static async syncProductToServer(productData) {
    const token = AuthService.getToken();
    if (!token) {
      throw new Error("User not authenticated");
    }

    try {
      // Prepare FormData for API
      const formData = new FormData();

      // Reconstruct product data for server
      const description = `${productData.name} - ${productData.description}`;
      formData.append("description", description);

      // Handle photo - convert base64 to blob if needed
      if (productData.photo) {
        if (productData.photo instanceof File) {
          formData.append("photo", productData.photo);
        } else if (
          typeof productData.photo === "string" &&
          productData.photo.startsWith("data:")
        ) {
          // Convert base64 to blob
          const response = await fetch(productData.photo);
          const blob = await response.blob();
          formData.append("photo", blob, "product.jpg");
        } else if (productData.photoUrl) {
          // Use photo URL if available
          const response = await fetch(productData.photoUrl);
          const blob = await response.blob();
          formData.append("photo", blob, "product.jpg");
        }
      }

      // Add location if available
      if (productData.lat && productData.lon) {
        formData.append("lat", productData.lat.toString());
        formData.append("lon", productData.lon.toString());
      }

      // Send to server
      const response = await ApiService.addStory(token, formData);

      if (!response.error) {
        // Mark product as synced
        await IndexedDBService.markProductAsSynced(
          productData.id,
          response.data.id
        );

        // Notify success
        this.notifyListeners("product_synced", {
          localId: productData.id,
          serverId: response.data.id,
        });

        return response.data;
      } else {
        throw new Error(response.message || "Failed to sync product");
      }
    } catch (error) {
      console.error("Error syncing product to server:", error);
      throw error;
    }
  }

  // ADD PRODUCT WITH OFFLINE SUPPORT
  static async addProductWithSync(productData) {
    // First add to local IndexedDB
    const localId = await IndexedDBService.addProduct(productData);

    // Add to sync queue
    await IndexedDBService.addToSyncQueue("ADD_PRODUCT", {
      ...productData,
      localId: localId,
    });

    // If online, try to sync immediately
    if (navigator.onLine) {
      try {
        await this.syncOfflineData();
      } catch (error) {
        console.log("Immediate sync failed, item remains in queue:", error);
      }
    }

    return localId;
  }

  // GET PRODUCTS WITH OFFLINE SUPPORT
  static async getProducts() {
    try {
      // Always try to get fresh data first if online
      if (navigator.onLine) {
        try {
          const token = AuthService.getToken();
          if (token) {
            const serverProducts = await ApiService.getStories(token);

            // Cache server products in IndexedDB
            if (
              serverProducts.listStory &&
              serverProducts.listStory.length > 0
            ) {
              await this.cacheServerProducts(serverProducts.listStory);
            }

            return serverProducts;
          }
        } catch (error) {
          console.log("Failed to fetch from server, using cached data:", error);
        }
      }

      // Fallback to local data
      const localProducts = await IndexedDBService.getAllProducts();
      const syncedProducts = localProducts.filter((p) => p.synced);

      return {
        error: false,
        message: navigator.onLine ? "online" : "offline",
        data: {
          listStory: syncedProducts.map((p) => this.formatProductForDisplay(p)),
        },
        offline: !navigator.onLine,
      };
    } catch (error) {
      console.error("Error getting products:", error);
      // Return empty data instead of throwing
      return {
        error: false,
        message: "error",
        data: { listStory: [] },
        offline: true,
      };
    }
  }

  static async cacheServerProducts(serverProducts) {
    for (const serverProduct of serverProducts) {
      try {
        // Check if product already exists locally
        const existingProducts = await IndexedDBService.getAllProducts();
        const existingProduct = existingProducts.find(
          (p) => p.serverId === serverProduct.id
        );

        if (!existingProduct) {
          // Add server product to local DB
          await IndexedDBService.addProduct({
            name: this.extractProductName(serverProduct.description),
            description: serverProduct.description,
            photoUrl: serverProduct.photoUrl,
            lat: serverProduct.lat,
            lon: serverProduct.lon,
            serverId: serverProduct.id,
            synced: true,
            local: false,
            createdAt: serverProduct.createdAt,
          });
        }
      } catch (error) {
        console.error("Error caching server product:", error);
      }
    }
  }

  static extractProductName(description) {
    // Extract product name from description (format: "name - description")
    if (description && description.includes(" - ")) {
      return description.split(" - ")[0];
    }
    return description || "Unnamed Product";
  }

  static formatProductForDisplay(product) {
    return {
      id: product.serverId || product.id,
      name: product.name,
      description: product.description,
      photoUrl: product.photoUrl || product.photo,
      createdAt: product.createdAt,
      lat: product.lat,
      lon: product.lon,
    };
  }

  // SYNC STATUS AND CONTROLS
  static async getSyncStatus() {
    try {
      const stats = await IndexedDBService.getStats();

      return {
        isOnline: navigator.onLine,
        isSyncing: this.isSyncing,
        lastSync: this.lastSyncTime,
        pendingSync: stats.pendingSync,
        totalProducts: stats.totalProducts,
        syncedProducts: stats.syncedProducts,
        localProducts: stats.localProducts,
      };
    } catch (error) {
      console.error("Error getting sync status:", error);
      return {
        isOnline: navigator.onLine,
        isSyncing: false,
        lastSync: null,
        pendingSync: 0,
        totalProducts: 0,
        syncedProducts: 0,
        localProducts: 0,
      };
    }
  }

  static async forceSync() {
    if (!navigator.onLine) {
      throw new Error("Cannot sync while offline");
    }

    return await this.syncOfflineData();
  }

  static async clearOfflineData() {
    await IndexedDBService.clearAllData();
    this.lastSyncTime = null;
    console.log("All offline data cleared");
  }

  // EVENT LISTENER SYSTEM
  static addListener(event, callback) {
    this.syncListeners.add({ event, callback });
  }

  static removeListener(event, callback) {
    this.syncListeners.forEach((listener) => {
      if (listener.event === event && listener.callback === callback) {
        this.syncListeners.delete(listener);
      }
    });
  }

  static notifyListeners(event, data = {}) {
    this.syncListeners.forEach((listener) => {
      if (listener.event === event) {
        try {
          listener.callback(data);
        } catch (error) {
          console.error("Error in sync listener:", error);
        }
      }
    });
  }

  // EXPORT/IMPORT DATA
  static async exportData() {
    return await IndexedDBService.exportData();
  }

  static async importData(data) {
    return await IndexedDBService.importData(data);
  }

  // Cleanup method
  static async cleanup() {
    this.stopPeriodicSync();
    this.syncListeners.clear();
  }
}

// Auto-initialize
SyncService.init().catch(console.error);
