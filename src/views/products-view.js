import { ApiService } from "../config/api.js";
import { AuthService } from "../utils/auth.js";
import { ViewTransition } from "../utils/view-transition.js";
import { SyncService } from "../utils/sync-service.js";

export class ProductsView {
  constructor() {
    this.element = document.createElement("div");
    this.element.className = "view products-view";
    this.element.setAttribute("role", "main");
    this.element.setAttribute("aria-label", "Products Page");
    this.stories = [];
    this.offlineMessage = null;
    this.syncStatus = null;
  }

  async render() {
    this.element.innerHTML = `
      <section class="products-section" aria-labelledby="products-title">
        <div class="section-header">
          <h1 id="products-title">Our Products</h1>
          <div class="products-controls">
            <div class="filter-controls">
              <label for="location-filter" class="filter-label">Filter by Location:</label>
              <select id="location-filter" class="filter-select" aria-label="Filter products by location availability">
                <option value="0">All Products</option>
                <option value="1">With Location</option>
              </select>
            </div>
            <div class="sync-controls">
              <button id="sync-btn" class="btn sync-btn" aria-label="Sync offline data">
                <span class="sync-icon">🔄</span>
                <span class="sync-text">Sync</span>
              </button>
              <button id="offline-info-btn" class="btn offline-info-btn" aria-label="Show offline information">
                <span class="offline-icon">📱</span>
                <span class="offline-text">Offline Info</span>
              </button>
            </div>
          </div>
        </div>
        
        <div class="sync-status" id="sync-status" aria-live="polite" hidden>
          <!-- Sync status will be shown here -->
        </div>
        
        <div class="loading-spinner" id="loading-spinner" aria-live="polite" aria-label="Loading products">
          <div class="spinner"></div>
          <p>Loading products...</p>
        </div>
        
        <div class="products-grid" id="products-grid" role="list" aria-label="List of products">
          <!-- Products will be loaded here -->
        </div>
        
        <div class="error-message" id="error-message" role="alert" aria-live="assertive" hidden>
          <!-- Error messages will be shown here -->
        </div>

        <!-- Offline Info Modal -->
        <div id="offline-info-modal" class="modal" hidden>
          <div class="modal-content">
            <div class="modal-header">
              <h2>Offline Information</h2>
              <button id="close-modal" class="btn-close" aria-label="Close modal">×</button>
            </div>
            <div class="modal-body">
              <div id="offline-stats">
                <p>Loading offline statistics...</p>
              </div>
            </div>
          </div>
        </div>
      </section>
    `;

    await this.loadProducts();
    this.attachEventListeners();
    this.setupSyncListeners();
    await ViewTransition.fadeIn(this.element);
    return this.element;
  }

  async loadProducts(locationFilter = 0) {
    const spinner = this.element.querySelector("#loading-spinner");
    const grid = this.element.querySelector("#products-grid");
    const errorMsg = this.element.querySelector("#error-message");

    try {
      spinner.style.display = "flex";
      grid.style.display = "none";
      errorMsg.hidden = true;

      // Remove existing offline message
      if (this.offlineMessage) {
        this.offlineMessage.remove();
        this.offlineMessage = null;
      }

      const token = AuthService.getToken();
      if (!token) {
        throw new Error("Please login to view products");
      }

      // Use SyncService to get products (handles offline/online automatically)
      const response = await SyncService.getProducts();

      // Update sync status
      await this.updateSyncStatus();

      // Handle offline response
      if (ApiService.isOfflineResponse(response) || response.offline) {
        this.displayOfflineMessage();
        console.log("Displaying offline products data");
      }

      // Get stories from response - with better error handling
      this.stories = response.listStory || response.data?.listStory || [];

      // Apply location filter
      if (locationFilter === 1) {
        this.stories = this.stories.filter((story) => story.lat && story.lon);
      }

      if (this.stories.length === 0) {
        grid.innerHTML = `
        <div class="empty-state" role="status">
          <p>${
            ApiService.isOfflineResponse(response) || response.offline
              ? "No cached products available offline"
              : "No products found. Be the first to add one!"
          }</p>
          ${
            !(ApiService.isOfflineResponse(response) || response.offline)
              ? `
            <a href="#/add-product" class="btn btn-primary" data-link>Add Product</a>
          `
              : ""
          }
        </div>
      `;
      } else {
        grid.innerHTML = this.stories
          .map(
            (story) => `
        <div class="product-card" role="listitem" data-product-id="${
          story.id
        }" tabindex="0">
          <div class="product-image">
            <img 
              src="${story.photoUrl}" 
              alt="${story.description || "Product image"}" 
              loading="lazy"
              onerror="this.src='data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNDAwIiBoZWlnaHQ9IjMwMCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48cmVjdCB3aWR0aD0iMTAwJSIgaGVpZ2h0PSIxMDAlIiBmaWxsPSIjZjNmNGY2Ii8+PHRleHQgeD0iNTAlIiB5PSI1MCUiIHRleHQtYW5jaG9yPSJtaWRkbGUiIGR5PSIwLjNlbSIgZm9udC1mYW1pbHk9IkFyaWFsLCBzYW5zLXNlcmlmIiBmb250LXNpemU9IjE0IiBmaWxsPSIjOWNhM2FmIj5Qcm9kdWN0IEltYWdlPC90ZXh0Pjwvc3ZnPg=='"
            >
          </div>
          <div class="product-info">
            <h3 class="product-name">${this.escapeHtml(
              story.name || "Unnamed Product"
            )}</h3>
            <p class="product-description">${this.escapeHtml(
              story.description || "No description available"
            )}</p>
            <div class="product-meta">
              <span class="product-date">${
                story.createdAt
                  ? new Date(story.createdAt).toLocaleDateString()
                  : "Unknown date"
              }</span>
              ${
                story.lat && story.lon
                  ? `
                <span class="product-location" aria-label="Has location information">📍</span>
              `
                  : ""
              }
            </div>
            ${
              ApiService.isOfflineResponse(response) || response.offline
                ? `
              <div class="offline-badge" aria-label="Viewing offline data">📶 Offline</div>
            `
                : ""
            }
          </div>
          <div class="product-actions">
            <button class="btn-delete" data-product-id="${
              story.id
            }" aria-label="Delete product">
              🗑️ Delete
            </button>
          </div>
        </div>
      `
          )
          .join("");
      }

      grid.style.display = this.stories.length > 0 ? "grid" : "block";
    } catch (error) {
      console.error("Error loading products:", error);

      // If offline and no cached data, show offline message
      if (!navigator.onLine) {
        this.displayOfflineMessage();
        grid.innerHTML = `
        <div class="empty-state" role="status">
          <p>No internet connection and no cached products available</p>
          <p><small>Please check your connection and try again</small></p>
        </div>
      `;
        grid.style.display = "block";
      } else {
        errorMsg.hidden = false;
        errorMsg.textContent = `Error loading products: ${error.message}`;
        grid.innerHTML = "";
      }
    } finally {
      spinner.style.display = "none";
    }
  }

  displayOfflineMessage() {
    // Remove existing offline message
    if (this.offlineMessage) {
      this.offlineMessage.remove();
    }

    this.offlineMessage = document.createElement("div");
    this.offlineMessage.className = "offline-message";
    this.offlineMessage.setAttribute("role", "status");
    this.offlineMessage.setAttribute("aria-live", "polite");
    this.offlineMessage.innerHTML = `
      <div class="offline-info">
        <span class="offline-icon">📶</span>
        <span>You are currently viewing offline data. Some features may be limited.</span>
      </div>
    `;

    const section = this.element.querySelector(".products-section");
    if (section) {
      section.insertBefore(
        this.offlineMessage,
        section.querySelector(".products-grid")
      );
    }
  }

  async updateSyncStatus() {
    const syncStatusElement = this.element.querySelector("#sync-status");
    this.syncStatus = await SyncService.getSyncStatus();

    if (this.syncStatus.pendingSync > 0 || this.syncStatus.localProducts > 0) {
      syncStatusElement.hidden = false;
      syncStatusElement.innerHTML = `
        <div class="sync-status-info">
          <span class="sync-status-icon">🔄</span>
          <div class="sync-status-text">
            <strong>Sync Status</strong>
            <p>${this.syncStatus.localProducts} local products, ${
        this.syncStatus.pendingSync
      } pending sync</p>
          </div>
          ${
            navigator.onLine
              ? `
            <button id="force-sync-btn" class="btn-sync-now">Sync Now</button>
          `
              : ""
          }
        </div>
      `;

      // Add event listener untuk force sync button
      const forceSyncBtn = syncStatusElement.querySelector("#force-sync-btn");
      if (forceSyncBtn) {
        forceSyncBtn.addEventListener("click", async () => {
          try {
            await SyncService.forceSync();
            await this.loadProducts();
            this.showMessage("Sync completed successfully!", "success");
          } catch (error) {
            this.showMessage(`Sync failed: ${error.message}`, "error");
          }
        });
      }
    } else {
      syncStatusElement.hidden = true;
    }
  }

  attachEventListeners() {
    const locationFilter = this.element.querySelector("#location-filter");
    const syncBtn = this.element.querySelector("#sync-btn");
    const offlineInfoBtn = this.element.querySelector("#offline-info-btn");

    // Location filter
    locationFilter.addEventListener("change", (e) => {
      this.loadProducts(parseInt(e.target.value));
    });

    // Sync button
    syncBtn.addEventListener("click", async () => {
      if (!navigator.onLine) {
        alert(
          "Cannot sync while offline. Please check your internet connection."
        );
        return;
      }

      syncBtn.disabled = true;
      syncBtn.innerHTML =
        '<span class="sync-icon">⏳</span><span class="sync-text">Syncing...</span>';

      try {
        await SyncService.forceSync();
        await this.loadProducts();
        this.showMessage("Sync completed successfully!", "success");
      } catch (error) {
        this.showMessage(`Sync failed: ${error.message}`, "error");
      } finally {
        syncBtn.disabled = false;
        syncBtn.innerHTML =
          '<span class="sync-icon">🔄</span><span class="sync-text">Sync</span>';
      }
    });

    // Offline info modal
    offlineInfoBtn.addEventListener("click", () => {
      this.showOfflineInfoModal();
    });

    // Delete product buttons
    const grid = this.element.querySelector("#products-grid");
    if (grid) {
      grid.addEventListener("click", async (e) => {
        if (e.target.classList.contains("btn-delete")) {
          const productId = e.target.getAttribute("data-product-id");
          await this.deleteProduct(productId);
        }
      });

      // Keyboard navigation for product cards
      grid.addEventListener("keydown", (e) => {
        if (e.key === "Enter" || e.key === " ") {
          const productCard = e.target.closest(".product-card");
          if (productCard) {
            e.preventDefault();
            // You can add product detail navigation here if needed
          }
        }
      });
    }

    // Listen for online/offline events
    window.addEventListener("online", () => {
      this.handleConnectionChange();
    });

    window.addEventListener("offline", () => {
      this.handleConnectionChange();
    });

    // ESC key to close modal
    document.addEventListener("keydown", (e) => {
      if (e.key === "Escape") {
        this.closeModal();
      }
    });
  }

  setupSyncListeners() {
    // Listen for sync events
    SyncService.addListener("sync_started", () => {
      this.showMessage("Sync started...", "info");
    });

    SyncService.addListener("sync_completed", () => {
      this.showMessage("Sync completed successfully!", "success");
      this.loadProducts(); // Refresh the list
    });

    SyncService.addListener("sync_failed", (data) => {
      this.showMessage(`Sync failed: ${data.error}`, "error");
    });

    SyncService.addListener("product_synced", (data) => {
      console.log("Product synced:", data);
      this.showMessage("Product synced with server!", "success");
    });
  }

  async showOfflineInfoModal() {
    const modal = this.element.querySelector("#offline-info-modal");
    const statsElement = this.element.querySelector("#offline-stats");

    const stats = await SyncService.getSyncStatus();

    statsElement.innerHTML = `
      <div class="offline-stats-grid">
        <div class="stat-item">
          <span class="stat-label">Online Status:</span>
          <span class="stat-value ${stats.isOnline ? "online" : "offline"}">
            ${stats.isOnline ? "🟢 Online" : "🔴 Offline"}
          </span>
        </div>
        <div class="stat-item">
          <span class="stat-label">Sync Status:</span>
          <span class="stat-value ${stats.isSyncing ? "syncing" : "idle"}">
            ${stats.isSyncing ? "🔄 Syncing" : "⚫ Idle"}
          </span>
        </div>
        <div class="stat-item">
          <span class="stat-label">Total Products:</span>
          <span class="stat-value">${stats.totalProducts}</span>
        </div>
        <div class="stat-item">
          <span class="stat-label">Synced Products:</span>
          <span class="stat-value">${stats.syncedProducts}</span>
        </div>
        <div class="stat-item">
          <span class="stat-label">Local Products:</span>
          <span class="stat-value">${stats.localProducts}</span>
        </div>
        <div class="stat-item">
          <span class="stat-label">Pending Sync:</span>
          <span class="stat-value">${stats.pendingSync}</span>
        </div>
        <div class="stat-item">
          <span class="stat-label">Last Sync:</span>
          <span class="stat-value">${
            stats.lastSync ? new Date(stats.lastSync).toLocaleString() : "Never"
          }</span>
        </div>
      </div>
      <div class="offline-actions">
        ${
          stats.localProducts > 0 && navigator.onLine
            ? `
          <button id="modal-sync-btn" class="btn btn-primary">Sync Now</button>
        `
            : ""
        }
        <button id="clear-offline-data" class="btn btn-secondary">Clear Offline Data</button>
      </div>
    `;

    // Show modal
    modal.hidden = false;

    // Add event listeners for modal buttons - HARUS SETELAH modal ditampilkan
    this.setupModalEventListeners();
  }

  setupModalEventListeners() {
    const modal = this.element.querySelector("#offline-info-modal");
    const closeModalBtn = this.element.querySelector("#close-modal");
    const statsElement = this.element.querySelector("#offline-stats");

    // Close modal button - FIXED: Gunakan arrow function untuk menjaga 'this'
    if (closeModalBtn) {
      // Hapus event listener lama jika ada
      closeModalBtn.replaceWith(closeModalBtn.cloneNode(true));
      const newCloseBtn = this.element.querySelector("#close-modal");
      
      newCloseBtn.addEventListener("click", () => {
        this.closeModal();
      });
    }

    // Close modal when clicking outside
    if (modal) {
      modal.addEventListener("click", (e) => {
        if (e.target === modal) {
          this.closeModal();
        }
      });
    }

    // Modal sync button
    const modalSyncBtn = statsElement?.querySelector("#modal-sync-btn");
    if (modalSyncBtn) {
      modalSyncBtn.addEventListener("click", async () => {
        try {
          await SyncService.forceSync();
          this.showOfflineInfoModal(); // Refresh stats
          this.showMessage("Sync completed successfully!", "success");
        } catch (error) {
          this.showMessage(`Sync failed: ${error.message}`, "error");
        }
      });
    }

    // Clear offline data button
    const clearDataBtn = statsElement?.querySelector("#clear-offline-data");
    if (clearDataBtn) {
      clearDataBtn.addEventListener("click", async () => {
        if (
          confirm(
            "Are you sure you want to clear all offline data? This cannot be undone."
          )
        ) {
          try {
            await SyncService.clearOfflineData();
            this.showMessage("Offline data cleared successfully", "success");
            this.closeModal();
            this.loadProducts(); // Refresh product list
          } catch (error) {
            this.showMessage(`Failed to clear data: ${error.message}`, "error");
          }
        }
      });
    }
  }

  closeModal() {
    const modal = this.element.querySelector("#offline-info-modal");
    if (modal) {
      modal.hidden = true;
    }
  }

  async deleteProduct(productId) {
    if (!confirm("Are you sure you want to delete this product?")) {
      return;
    }

    try {
      // For now, we'll just remove it from the local view
      // In a real app, you would also delete from server and IndexedDB
      this.stories = this.stories.filter((story) => story.id !== productId);
      await this.loadProducts(); // Refresh the list
      this.showMessage("Product deleted successfully", "success");
    } catch (error) {
      this.showMessage(`Failed to delete product: ${error.message}`, "error");
    }
  }

  handleConnectionChange() {
    // Refresh products when connection changes
    const currentFilter = this.element.querySelector("#location-filter").value;
    this.loadProducts(parseInt(currentFilter));
    this.updateSyncStatus();
  }

  showMessage(message, type) {
    // Hapus pesan lama jika ada
    const oldMessages = this.element.querySelectorAll('.message');
    oldMessages.forEach(msg => msg.remove());

    const messageEl = document.createElement("div");
    messageEl.className = `message message-${type}`;
    messageEl.setAttribute("role", "alert");
    messageEl.setAttribute("aria-live", "polite");
    messageEl.textContent = message;

    const section = this.element.querySelector(".products-section");
    if (section) {
      section.insertBefore(messageEl, section.querySelector(".products-grid"));
    }

    setTimeout(() => {
      if (messageEl.parentNode) {
        messageEl.remove();
      }
    }, 5000);
  }

  escapeHtml(unsafe) {
    if (!unsafe) return "";
    return unsafe
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");
  }

  // Cleanup when view is destroyed
  destroy() {
    // Remove sync listeners
    SyncService.syncListeners.clear();
    
    // Remove global event listeners
    document.removeEventListener("keydown", this.handleEscapeKey);
  }

  // Handler untuk ESC key
  handleEscapeKey = (e) => {
    if (e.key === "Escape") {
      this.closeModal();
    }
  }
}