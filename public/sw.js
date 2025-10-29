// public/sw.js - Enhanced Development Mode Handling
const CACHE_NAME = 'ecommerce-v4.0.0';
const API_CACHE_NAME = 'ecommerce-api-v2';
const STATIC_CACHE_NAME = 'ecommerce-static-v2';
const IMAGE_CACHE_NAME = 'ecommerce-images-v2';

// Development mode detection
const isDevelopment = self.location.hostname === 'localhost' || 
                     self.location.hostname === '127.0.0.1';

// Static assets to cache
const STATIC_ASSETS = [
  '/',
  '/index.html',
  '/src/main.js',
  '/src/app.js',
  '/src/config/api.js',
  '/src/utils/auth.js',
  '/src/utils/view-transition.js',
  '/src/utils/pwa-service.js',
  '/src/utils/sync-service.js',
  '/src/utils/indexeddb-service.js',
  '/src/components/header.js',
  '/src/components/footer.js',
  '/src/views/home-view.js',
  '/src/views/products-view.js',
  '/src/views/map-view.js',
  '/src/views/add-product-view.js',
  '/src/views/login-view.js',
  '/src/styles/main.css',
  '/manifest.json',
  '/icons/icon-192x192.png',
  '/icons/icon-512x512.png'
];

// Install Event - Cache static assets
self.addEventListener('install', (event) => {
  console.log('Service Worker installing in', isDevelopment ? 'development' : 'production');
  
  if (isDevelopment) {
    console.log('Development mode - skipping initial cache');
    self.skipWaiting();
    return;
  }

  event.waitUntil(
    (async () => {
      try {
        // Open static cache
        const staticCache = await caches.open(STATIC_CACHE_NAME);
        console.log('Caching static assets');
        
        // Cache static assets with error handling
        const cachePromises = STATIC_ASSETS.map(async (asset) => {
          try {
            await staticCache.add(asset);
          } catch (error) {
            console.warn(`Failed to cache ${asset}:`, error);
          }
        });
        
        await Promise.all(cachePromises);
        console.log('Static assets cached successfully');
        
        // Skip waiting to activate immediately
        await self.skipWaiting();
      } catch (error) {
        console.error('Installation failed:', error);
      }
    })()
  );
});

// Activate Event - Clean up old caches
self.addEventListener('activate', (event) => {
  console.log('Service Worker activating');
  
  event.waitUntil(
    (async () => {
      try {
        // Clean up old caches
        const cacheNames = await caches.keys();
        const validCacheNames = [CACHE_NAME, STATIC_CACHE_NAME, API_CACHE_NAME, IMAGE_CACHE_NAME];
        
        const deletePromises = cacheNames.map(async (cacheName) => {
          if (!validCacheNames.includes(cacheName)) {
            console.log('Deleting old cache:', cacheName);
            await caches.delete(cacheName);
          }
        });
        
        await Promise.all(deletePromises);
        console.log('Cache cleanup completed');
        
        // Claim clients
        await self.clients.claim();
        console.log('Service Worker activated and claiming clients');
        
        // Send ready message to all clients
        const clients = await self.clients.matchAll();
        clients.forEach(client => {
          client.postMessage({
            type: 'SW_READY',
            message: 'Service Worker is ready'
          });
        });
      } catch (error) {
        console.error('Activation failed:', error);
      }
    })()
  );
});

// Fetch Event - Enhanced caching strategies with better development handling
self.addEventListener('fetch', (event) => {
  // Skip non-GET requests
  if (event.request.method !== 'GET') {
    return;
  }

  const url = new URL(event.request.url);

  // Skip analytics and external scripts in development
  if (isDevelopment) {
    if (shouldSkipRequestInDevelopment(event.request)) {
      return;
    }
  }

  // Skip analytics and external scripts in production
  if (isAnalyticsRequest(event.request) || 
      url.protocol === 'chrome-extension:' ||
      url.hostname.includes('googleapis.com') ||
      url.hostname.includes('gstatic.com')) {
    return;
  }

  // Handle different types of requests
  if (isDevelopment) {
    event.respondWith(handleDevelopmentFetch(event));
  } else if (isStaticAsset(event.request)) {
    event.respondWith(handleStaticFetch(event));
  } else if (isApiRequest(event.request)) {
    event.respondWith(handleApiFetch(event));
  } else if (isImageRequest(event.request)) {
    event.respondWith(handleImageFetch(event));
  } else {
    // For other requests in production, let them through
    return;
  }
});

// Development fetch handler - Bypass Service Worker for most requests
async function handleDevelopmentFetch(event) {
  const url = new URL(event.request.url);
  
  // Skip certain requests entirely in development
  if (shouldSkipRequestInDevelopment(event.request)) {
    return fetch(event.request);
  }

  // For API calls, always go to network with proper error handling
  if (isApiRequest(event.request)) {
    try {
      console.log('Development: Fetching API:', event.request.url);
      const response = await fetch(event.request);
      
      // Check if response is valid
      if (!response.ok) {
        console.log('Development: API response not OK:', response.status);
        return createOfflineResponse();
      }
      
      return response;
    } catch (error) {
      console.log('Development: API call failed, returning offline response:', error.message);
      return createOfflineResponse();
    }
  }
  
  // For Vite development server requests, always go to network
  if (url.pathname.includes('/@vite/') || url.pathname.includes('/src/') || url.search.includes('t=')) {
    try {
      return await fetch(event.request);
    } catch (error) {
      console.log('Development: Vite request failed:', error.message);
      return new Response('Development Server Error', { status: 503 });
    }
  }

  // For static assets in development, try cache first but don't fail
  if (isStaticAsset(event.request)) {
    try {
      const cachedResponse = await caches.match(event.request);
      if (cachedResponse) {
        console.log('Development: Serving from cache:', event.request.url);
        return cachedResponse;
      }
    } catch (error) {
      console.log('Development: Cache match failed:', error);
    }
  }
  
  // Default: try network with better error handling
  try {
    const response = await fetch(event.request);
    return response;
  } catch (error) {
    console.log('Development: Network failed for:', event.request.url);
    
    // For navigation requests, try to return something useful
    if (event.request.mode === 'navigate') {
      try {
        const cachedResponse = await caches.match('/');
        if (cachedResponse) {
          return cachedResponse;
        }
      } catch (cacheError) {
        console.log('Development: Cache fallback failed:', cacheError);
      }
    }
    
    // Return a simple error response
    return new Response('Development: Network error', { 
      status: 408,
      headers: { 'Content-Type': 'text/plain' }
    });
  }
}

// Helper function to determine which requests to skip in development
function shouldSkipRequestInDevelopment(request) {
  const url = new URL(request.url);
  
  // Skip external domains (analytics, tracking, etc.)
  if (!url.hostname.includes('localhost') && !url.hostname.includes('127.0.0.1')) {
    return true;
  }
  
  // Skip Vite specific requests
  if (url.pathname.includes('/@vite/') || url.pathname.includes('/@id/')) {
    return true;
  }
  
  // Skip HMR requests
  if (url.pathname.includes('.hot-update.') || url.search.includes('t=')) {
    return true;
  }
  
  // Skip favicon and manifest in development
  if (url.pathname.includes('favicon.ico') || url.pathname.includes('manifest.json')) {
    return true;
  }
  
  return false;
}

// Static assets - Cache First with Network Update
async function handleStaticFetch(event) {
  const cache = await caches.open(STATIC_CACHE_NAME);
  
  try {
    // Try cache first
    const cachedResponse = await cache.match(event.request);
    if (cachedResponse) {
      // Update cache in background
      updateCacheInBackground(cache, event.request);
      return cachedResponse;
    }
    
    // If not in cache, fetch from network
    const networkResponse = await fetch(event.request);
    
    // Cache the new response
    if (networkResponse.ok) {
      await cache.put(event.request, networkResponse.clone());
    }
    
    return networkResponse;
  } catch (error) {
    console.log('Static fetch failed:', error);
    
    // For navigation requests, return offline page
    if (event.request.mode === 'navigate') {
      const offlinePage = await cache.match('/');
      if (offlinePage) return offlinePage;
    }
    
    throw error;
  }
}

// API requests - Network First with Cache Fallback
async function handleApiFetch(event) {
  const cache = await caches.open(API_CACHE_NAME);
  
  try {
    // Try network first
    const networkResponse = await fetch(event.request);
    
    // Cache successful responses
    if (networkResponse.ok) {
      await cache.put(event.request, networkResponse.clone());
      console.log('API response cached');
    }
    
    return networkResponse;
  } catch (error) {
    console.log('Network failed, trying cache for API');
    
    // Try cache
    const cachedResponse = await cache.match(event.request);
    if (cachedResponse) {
      console.log('Serving API from cache');
      return cachedResponse;
    }
    
    // No cache available, return offline response
    console.log('No cache available, returning offline response');
    return createOfflineResponse();
  }
}

// Image requests - Cache First with Network Fallback
async function handleImageFetch(event) {
  const cache = await caches.open(IMAGE_CACHE_NAME);
  
  // Try cache first
  const cachedResponse = await cache.match(event.request);
  if (cachedResponse) {
    return cachedResponse;
  }
  
  try {
    // Try network
    const networkResponse = await fetch(event.request);
    
    // Cache successful image responses
    if (networkResponse.ok) {
      await cache.put(event.request, networkResponse.clone());
    }
    
    return networkResponse;
  } catch (error) {
    console.log('Image fetch failed, returning placeholder');
    
    // Return placeholder image
    return createImagePlaceholder();
  }
}

// Helper function to update cache in background
function updateCacheInBackground(cache, request) {
  fetch(request)
    .then(response => {
      if (response.ok) {
        cache.put(request, response);
      }
    })
    .catch(() => {
      // Silent fail for background updates
    });
}

// Create offline response for API
function createOfflineResponse() {
  const offlineData = {
    error: false,
    message: 'offline',
    data: { 
      listStory: [],
      stories: []
    },
    offline: true,
    timestamp: new Date().toISOString()
  };

  return new Response(JSON.stringify(offlineData), {
    status: 200,
    headers: {
      'Content-Type': 'application/json',
      'Cache-Control': 'no-cache'
    }
  });
}

// Create image placeholder
function createImagePlaceholder() {
  const svg = `
    <svg width="400" height="300" xmlns="http://www.w3.org/2000/svg">
      <rect width="100%" height="100%" fill="#f3f4f6"/>
      <text x="50%" y="50%" text-anchor="middle" dy="0.3em" 
            font-family="Arial, sans-serif" font-size="14" fill="#9ca3af">
        Image Not Available Offline
      </text>
    </svg>
  `;
  
  return new Response(svg, {
    headers: {
      'Content-Type': 'image/svg+xml',
      'Cache-Control': 'public, max-age=86400'
    }
  });
}

// Helper functions to identify request types
function isStaticAsset(request) {
  const url = new URL(request.url);
  return url.origin === self.location.origin &&
         (url.pathname.includes('/src/') ||
          url.pathname.includes('/styles/') ||
          url.pathname.endsWith('.js') ||
          url.pathname.endsWith('.css') ||
          url.pathname === '/');
}

function isApiRequest(request) {
  const url = new URL(request.url);
  return url.hostname === 'story-api.dicoding.dev';
}

function isImageRequest(request) {
  const url = new URL(request.url);
  return request.destination === 'image' ||
         url.pathname.includes('/images/') ||
         url.hostname.includes('unsplash.com');
}

function isAnalyticsRequest(request) {
  const url = new URL(request.url);
  return url.hostname.includes('google-analytics') ||
         url.hostname.includes('analytics') ||
         url.hostname.includes('reasonlabsapi.com') ||
         url.hostname.includes('gtag') ||
         url.hostname.includes('googletagmanager');
}

// Push Notification Support
self.addEventListener('push', (event) => {
  console.log('Push event received');
  
  if (!event.data) return;

  let data;
  try {
    data = event.data.json();
  } catch (error) {
    data = {
      title: 'E-Commerce App',
      body: 'You have a new notification',
      icon: '/icons/icon-192x192.png'
    };
  }

  const options = {
    body: data.body || data.message || 'New update available',
    icon: data.icon || '/icons/icon-192x192.png',
    badge: '/icons/badge-72x72.png',
    image: data.image,
    data: data.data || { url: data.url || '/' },
    tag: data.tag || 'general',
    requireInteraction: data.requireInteraction || false,
    actions: data.actions || []
  };

  event.waitUntil(
    self.registration.showNotification(data.title || 'E-Commerce App', options)
  );
});

// Notification Click Handler
self.addEventListener('notificationclick', (event) => {
  console.log('Notification clicked');
  event.notification.close();

  const urlToOpen = event.notification.data?.url || '/';

  event.waitUntil(
    self.clients.matchAll({ 
      type: 'window', 
      includeUncontrolled: true 
    }).then((windowClients) => {
      // Check if there's already a window/tab open with the target URL
      for (let client of windowClients) {
        if (client.url.includes(self.location.origin) && 'focus' in client) {
          return client.navigate(urlToOpen).then(() => client.focus());
        }
      }
      
      // If no window is open, open a new one
      if (self.clients.openWindow) {
        return self.clients.openWindow(urlToOpen);
      }
    })
  );
});

// Message handler for communication with main thread
self.addEventListener('message', (event) => {
  console.log('Message received in SW:', event.data);
  
  const { type, payload } = event.data;
  
  switch (type) {
    case 'SKIP_WAITING':
      self.skipWaiting();
      break;
      
    case 'GET_CACHE_STATUS':
      getCacheStatus().then(status => {
        event.ports[0].postMessage(status);
      });
      break;
      
    case 'CLEAR_CACHE':
      clearCache();
      break;

    case 'ENABLE_DEVELOPMENT_MODE':
      console.log('Development mode enabled in Service Worker');
      break;
  }
});

// Get cache status for debugging
async function getCacheStatus() {
  try {
    const cacheNames = await caches.keys();
    const status = {
      totalCaches: cacheNames.length,
      caches: {},
      isDevelopment: isDevelopment
    };
    
    for (const cacheName of cacheNames) {
      const cache = await caches.open(cacheName);
      const requests = await cache.keys();
      status.caches[cacheName] = {
        count: requests.length,
        urls: requests.slice(0, 5).map(req => req.url) // Limit to first 5 URLs
      };
    }
    
    return status;
  } catch (error) {
    console.error('Failed to get cache status:', error);
    return { error: error.message };
  }
}

// Clear all caches
async function clearCache() {
  try {
    const cacheNames = await caches.keys();
    await Promise.all(cacheNames.map(cacheName => caches.delete(cacheName)));
    console.log('All caches cleared');
  } catch (error) {
    console.error('Failed to clear caches:', error);
  }
}

console.log('Service Worker loaded successfully');
console.log('Development mode:', isDevelopment);