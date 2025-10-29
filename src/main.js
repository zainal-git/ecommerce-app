// src/main.js - Enhanced with Development Support
import { App } from './app.js';
import { PwaService } from './utils/pwa-service.js';
import { SyncService } from './utils/sync-service.js';

// Check if we're in development
const isDevelopment = window.location.hostname === 'localhost' || 
                     window.location.hostname === '127.0.0.1';

let app = null;

// Initialize the application when DOM is loaded
document.addEventListener('DOMContentLoaded', async () => {
  try {
    console.log('Initializing E-Commerce App...');
    console.log('Development mode:', isDevelopment);

    // Initialize PWA features first
    PwaService.init();
    
    // Initialize Sync Service (IndexedDB)
    await SyncService.init();
    
    // Then initialize the main app
    app = new App();
    await app.init();
    
    // Initialize service worker for push notifications and caching
    await initializeServiceWorker();
    
    // Check and show install prompt if applicable
    setTimeout(() => {
      checkAndShowInstallPrompt();
    }, 3000);
    
  } catch (error) {
    console.error('Error initializing app:', error);
    // Show user-friendly error message
    if (isDevelopment) {
      PwaService.showMessage(`Development Error: ${error.message}`, 'error', 10000);
    }
  }
});

// Enhanced service worker registration with development support
async function initializeServiceWorker() {
  if (!('serviceWorker' in navigator)) {
    console.log('Service Workers are not supported in this browser');
    if (isDevelopment) {
      PwaService.showMessage('Service Worker not supported in this browser', 'warning');
    }
    return;
  }

  try {
    // In development, unregister any existing service workers first
    if (isDevelopment) {
      const registrations = await navigator.serviceWorker.getRegistrations();
      for (let registration of registrations) {
        console.log('Unregistering old service worker:', registration);
        await registration.unregister();
      }
      console.log('Cleared old service workers for development');
    }

    const registration = await navigator.serviceWorker.register('/sw.js', {
      scope: '/',
      updateViaCache: 'none'
    });
    
    console.log('Service Worker registered successfully:', registration);

    // Send development mode info to service worker
    if (isDevelopment && registration.active) {
      registration.active.postMessage({
        type: 'ENABLE_DEVELOPMENT_MODE'
      });
    }

    // Development-specific logging
    if (isDevelopment) {
      console.log('Service Worker scope:', registration.scope);
      console.log('Service Worker state:', registration.active?.state);
    }

    // Check for updates
    registration.addEventListener('updatefound', () => {
      const newWorker = registration.installing;
      console.log('New service worker found:', newWorker);
      
      newWorker.addEventListener('statechange', () => {
        console.log('Service Worker state changed:', newWorker.state);
        if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
          // New update available
          showUpdateNotification(registration);
        }
      });
    });

    // Handle controller change
    navigator.serviceWorker.addEventListener('controllerchange', () => {
      console.log('Service worker controller changed');
      if (!isDevelopment) {
        showUpdateSuccessNotification();
      }
    });

  } catch (error) {
    console.error('Service Worker registration failed:', error);
    
    if (isDevelopment) {
      const errorMsg = `Service Worker Error: ${error.message}. This is normal in development.`;
      PwaService.showMessage(errorMsg, 'warning', 8000);
    } else {
      PwaService.showMessage('Offline features unavailable', 'warning', 5000);
    }
  }
}

// Check and show install prompt
function checkAndShowInstallPrompt() {
  // Don't show install prompt in development
  if (isDevelopment) {
    console.log('Development mode - skipping install prompt');
    return;
  }

  const status = PwaService.getInstallStatus();
  
  if (status.canInstall && !status.isStandalone) {
    // Show install prompt after a delay
    setTimeout(() => {
      PwaService.showInstallPrompt();
    }, 2000);
  }
}

// Show update notification (only in production)
function showUpdateNotification(registration) {
  if (isDevelopment) {
    console.log('Development mode - skipping update notification');
    return;
  }

  const notification = document.createElement('div');
  notification.className = 'update-notification';
  notification.innerHTML = `
    <div class="update-content">
      <span class="update-icon">🔄</span>
      <div class="update-text">
        <strong>New Version Available</strong>
        <p>A new version of the app is ready</p>
      </div>
    </div>
    <button id="update-btn" class="btn-update">Update Now</button>
  `;
  
  document.body.appendChild(notification);
  
  document.getElementById('update-btn').addEventListener('click', () => {
    if (registration.waiting) {
      registration.waiting.postMessage({ type: 'SKIP_WAITING' });
    }
    notification.remove();
  });

  // Auto remove after 30 seconds
  setTimeout(() => {
    if (notification.parentNode) {
      notification.remove();
    }
  }, 30000);
}

// Show update success notification (only in production)
function showUpdateSuccessNotification() {
  if (isDevelopment) return;
  
  PwaService.showMessage('App updated successfully!', 'success', 3000);
  setTimeout(() => {
    window.location.reload();
  }, 1000);
}

// Handle messages from service worker
if ('serviceWorker' in navigator) {
  navigator.serviceWorker.addEventListener('message', (event) => {
    console.log('Message from service worker:', event.data);
    
    if (event.data && event.data.type === 'NAVIGATE') {
      window.location.href = event.data.url;
    }
    
    if (event.data && event.data.type === 'CACHE_UPDATED') {
      PwaService.showMessage('Content updated for offline use', 'success', 3000);
    }
  });

  // Listen for service worker ready
  navigator.serviceWorker.ready.then((registration) => {
    console.log('Service Worker is ready:', registration);
  });
}

// Development helper: Clear all caches
if (isDevelopment) {
  window._clearAllCaches = async () => {
    if ('serviceWorker' in navigator) {
      const registration = await navigator.serviceWorker.ready;
      if (registration.active) {
        registration.active.postMessage({ type: 'CLEAR_CACHE' });
      }
    }
    
    const cacheNames = await caches.keys();
    for (const cacheName of cacheNames) {
      await caches.delete(cacheName);
    }
    
    // Clear IndexedDB
    if (window.SyncService) {
      await SyncService.clearOfflineData();
    }
    
    console.log('All caches and data cleared');
    PwaService.showMessage('All caches cleared for development', 'success', 3000);
  };
  
  window._getCacheStatus = async () => {
    if ('serviceWorker' in navigator) {
      const registration = await navigator.serviceWorker.ready;
      return new Promise((resolve) => {
        const channel = new MessageChannel();
        channel.port1.onmessage = (event) => {
          resolve(event.data);
        };
        registration.active.postMessage(
          { type: 'GET_CACHE_STATUS' },
          [channel.port2]
        );
      });
    }
    return null;
  };
  
  window._disableSW = async () => {
    const registrations = await navigator.serviceWorker.getRegistrations();
    for (let registration of registrations) {
      await registration.unregister();
    }
    // Also clear all caches
    const cacheNames = await caches.keys();
    for (const cacheName of cacheNames) {
      await caches.delete(cacheName);
    }
    console.log('Service Worker disabled and caches cleared');
    window.location.reload();
  };
  
  console.log('Development helpers loaded. Use:');
  console.log('_clearAllCaches() - Clear all caches and data');
  console.log('_getCacheStatus() - Get cache status');
  console.log('_disableSW() - Disable Service Worker completely');
}

// Export for testing purposes
export { initializeServiceWorker, PwaService, isDevelopment };