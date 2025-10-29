// src/utils/pwa-service.js - Enhanced with Better Install Prompt
export class PwaService {
  static deferredPrompt = null;
  static isInstalled = false;
  static isStandalone = false;
  static isDevelopment =
    window.location.hostname === "localhost" ||
    window.location.hostname === "127.0.0.1";
  static installPromptShown = false;

  static init() {
    console.log("PWA Service initializing...");

    this.checkStandaloneMode();
    this.setupBeforeInstallPrompt();
    this.setupAppInstalled();
    this.setupOnlineOfflineEvents();
    this.setupInstallPromptDismissal();

    console.log("PWA Service initialized", {
      isDevelopment: this.isDevelopment,
      isStandalone: this.isStandalone,
      isInstalled: this.isInstalled,
    });
  }

  static checkStandaloneMode() {
    this.isStandalone =
      window.matchMedia("(display-mode: standalone)").matches ||
      window.navigator.standalone === true;

    if (this.isStandalone) {
      console.log("App is running in standalone mode");
      this.isInstalled = true;
    }
  }

  static setupBeforeInstallPrompt() {
    window.addEventListener("beforeinstallprompt", (e) => {
      console.log("beforeinstallprompt event fired");

      // Prevent Chrome 67 and earlier from automatically showing the prompt
      e.preventDefault();

      // Stash the event so it can be triggered later
      this.deferredPrompt = e;

      // Update UI to notify the user they can add to home screen
      this.showInstallPrompt();

      // Log for debugging
      console.log("Install prompt is available");
    });
  }

  static setupAppInstalled() {
    window.addEventListener("appinstalled", (e) => {
      console.log("PWA was installed successfully");
      this.isInstalled = true;
      this.isStandalone = true;
      this.hideInstallPrompt();

      this.showMessage("App installed successfully! 🎉", "success", 3000);

      // Track installation
      this.trackInstallation();
    });
  }

  static setupOnlineOfflineEvents() {
    window.addEventListener("online", () => {
      console.log("App came online");
      this.hideOfflineIndicator();
      this.showMessage("Connection restored", "success", 2000);
    });

    window.addEventListener("offline", () => {
      console.log("App went offline");
      this.showOfflineIndicator();
      this.showMessage("You are currently offline", "warning", 3000);
    });

    // Initial check
    if (!navigator.onLine) {
      this.showOfflineIndicator();
    }
  }

  static setupInstallPromptDismissal() {
    // Hide install prompt when user navigates away
    window.addEventListener("hashchange", () => {
      if (this.installPromptShown) {
        this.hideInstallPrompt();
      }
    });

    // Hide install prompt when user scrolls
    window.addEventListener("scroll", () => {
      if (this.installPromptShown) {
        this.hideInstallPrompt();
      }
    });
  }

  static showInstallPrompt() {
    // Don't show if already installed or in standalone mode
    if (this.isInstalled || this.isStandalone) {
      console.log("App already installed, skipping install prompt");
      return;
    }

    // Don't show in development
    if (this.isDevelopment) {
      console.log("Development mode - install prompt suppressed");
      return;
    }

    // Don't show if already shown recently
    if (this.installPromptShown) {
      return;
    }

    const installPrompt = document.getElementById("install-prompt");
    if (!installPrompt) {
      console.warn("Install prompt element not found");
      return;
    }

    // Show the prompt with animation
    installPrompt.hidden = false;
    this.installPromptShown = true;

    console.log("Install prompt shown to user");

    // Add event listeners for buttons
    const installConfirm = document.getElementById("install-confirm");
    const installCancel = document.getElementById("install-cancel");

    if (installConfirm) {
      installConfirm.onclick = () => this.installApp();
    }

    if (installCancel) {
      installCancel.onclick = () => this.hideInstallPrompt();
    }

    // Auto-hide after 30 seconds
    setTimeout(() => {
      if (this.installPromptShown) {
        this.hideInstallPrompt();
      }
    }, 30000);
  }

  static hideInstallPrompt() {
    const installPrompt = document.getElementById("install-prompt");
    if (installPrompt) {
      installPrompt.hidden = true;
      this.installPromptShown = false;
    }
  }

  static async installApp() {
    if (!this.deferredPrompt) {
      console.log("No install prompt available");
      this.showMessage("Installation not available at the moment", "error");
      return;
    }

    try {
      // Show the install prompt
      this.deferredPrompt.prompt();

      // Wait for the user to respond to the prompt
      const { outcome } = await this.deferredPrompt.userChoice;

      console.log(`User response to install prompt: ${outcome}`);

      // We've used the prompt, and can't use it again, throw it away
      this.deferredPrompt = null;

      // Hide our custom install prompt
      this.hideInstallPrompt();

      if (outcome === "accepted") {
        console.log("User accepted the install prompt");
        this.showMessage("Installing app...", "success", 2000);
      } else {
        console.log("User dismissed the install prompt");
        this.showMessage("Installation cancelled", "info", 2000);
      }
    } catch (error) {
      console.error("Error during installation:", error);
      this.showMessage("Installation failed. Please try again.", "error");
    }
  }

  static showOfflineIndicator() {
    const offlineIndicator = document.getElementById("offline-indicator");
    if (offlineIndicator) {
      offlineIndicator.hidden = false;
    }
  }

  static hideOfflineIndicator() {
    const offlineIndicator = document.getElementById("offline-indicator");
    if (offlineIndicator) {
      offlineIndicator.hidden = true;
    }
  }

  static canInstall() {
    return (
      this.deferredPrompt !== null &&
      !this.isInstalled &&
      !this.isStandalone &&
      !this.isDevelopment
    );
  }

  static getInstallStatus() {
    return {
      canInstall: this.canInstall(),
      isInstalled: this.isInstalled,
      isStandalone: this.isStandalone,
      isDevelopment: this.isDevelopment,
      installPromptShown: this.installPromptShown,
    };
  }

  static showMessage(message, type = "info", duration = 4000) {
    // Create message element
    const messageEl = document.createElement("div");
    messageEl.className = `pwa-message pwa-message-${type}`;
    messageEl.setAttribute("role", "alert");
    messageEl.setAttribute("aria-live", "polite");

    messageEl.innerHTML = `
      <span class="pwa-message-text">${message}</span>
      <button class="pwa-message-close" aria-label="Close message">×</button>
    `;

    // Add styles if not already added
    if (!document.querySelector("#pwa-message-styles")) {
      const styles = document.createElement("style");
      styles.id = "pwa-message-styles";
      styles.textContent = `
        .pwa-message {
          position: fixed;
          top: 20px;
          right: 20px;
          background: white;
          padding: 1rem 1.5rem;
          border-radius: 8px;
          box-shadow: 0 4px 12px rgba(0,0,0,0.15);
          z-index: 10000;
          display: flex;
          align-items: center;
          gap: 1rem;
          max-width: 400px;
          animation: slideInRight 0.3s ease;
          border-left: 4px solid;
        }
        .pwa-message-success {
          border-left-color: #10b981;
        }
        .pwa-message-error {
          border-left-color: #ef4444;
        }
        .pwa-message-warning {
          border-left-color: #f59e0b;
        }
        .pwa-message-info {
          border-left-color: #2563eb;
        }
        .pwa-message-close {
          background: none;
          border: none;
          font-size: 1.5rem;
          cursor: pointer;
          padding: 0;
          width: 24px;
          height: 24px;
          display: flex;
          align-items: center;
          justify-content: center;
          color: #64748b;
          border-radius: 4px;
        }
        .pwa-message-close:hover {
          background: #f1f5f9;
          color: #475569;
        }
        @keyframes slideInRight {
          from {
            transform: translateX(100%);
            opacity: 0;
          }
          to {
            transform: translateX(0);
            opacity: 1;
          }
        }
      `;
      document.head.appendChild(styles);
    }

    document.body.appendChild(messageEl);

    // Add close event
    const closeBtn = messageEl.querySelector(".pwa-message-close");
    closeBtn.addEventListener("click", () => {
      messageEl.remove();
    });

    // Auto remove after duration
    if (duration > 0) {
      setTimeout(() => {
        if (messageEl.parentNode) {
          messageEl.remove();
        }
      }, duration);
    }

    return messageEl;
  }

  static trackInstallation() {
    // Here you can track installations in your analytics
    console.log("Tracking PWA installation");

    // Example: Send to analytics
    if (typeof gtag !== "undefined") {
      gtag("event", "pwa_installed");
    }
  }

  // Check if app meets PWA criteria
  static async checkPwaReadiness() {
    const checks = {
      https: window.location.protocol === "https:",
      serviceWorker: "serviceWorker" in navigator,
      manifest: document.querySelector('link[rel="manifest"]') !== null,
      installable: this.canInstall(),
    };

    const allChecksPassed = Object.values(checks).every((check) => check);

    console.log("PWA Readiness Check:", checks);

    return {
      checks,
      allChecksPassed,
      isPwaReady: allChecksPassed,
    };
  }
}

// Initialize when DOM is ready
if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", () => PwaService.init());
} else {
  PwaService.init();
}
