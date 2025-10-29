export const API_CONFIG = {
  BASE_URL: 'https://story-api.dicoding.dev/v1',
  ENDPOINTS: {
    REGISTER: '/register',
    LOGIN: '/login',
    STORIES: '/stories',
    STORIES_GUEST: '/stories/guest',
    NOTIFICATIONS: '/notifications/subscribe'
  }
};

export class ApiService {
  static async request(endpoint, options = {}) {
    const url = `${API_CONFIG.BASE_URL}${endpoint}`;
    
    // Handle FormData (no Content-Type for multipart/form-data)
    const isFormData = options.body instanceof FormData;
    const headers = isFormData 
      ? { ...options.headers }
      : { 
          'Content-Type': 'application/json',
          ...options.headers 
        };

    const config = {
      headers,
      ...options
    };

    // Convert body to JSON if it's not FormData
    if (!isFormData && config.body && typeof config.body === 'object') {
      config.body = JSON.stringify(config.body);
    }

    try {
      const response = await fetch(url, config);
      
      // Check if response is from service worker offline mode
      if (response.status === 503 || response.status === 408) {
        const offlineData = await this.createOfflineResponse();
        return offlineData;
      }
      
      const data = await response.json();
      
      if (!response.ok) {
        throw new Error(data.message || `Request failed with status ${response.status}`);
      }
      
      return data;
    } catch (error) {
      console.error('API request failed:', error);
      
      // Check if we're offline and this is a GET request
      const isGetRequest = !options.method || options.method === 'GET';
      const isOffline = !navigator.onLine;
      
      if (isOffline && isGetRequest) {
        console.log('Browser offline mode - returning offline data');
        return this.createOfflineResponse();
      }
      
      // For POST requests or when online but network failed, throw the error
      throw new Error(error.message || 'Network error');
    }
  }

  static createOfflineResponse() {
    return {
      error: false,
      message: 'offline',
      data: { listStory: [] },
      offline: true,
      timestamp: new Date().toISOString()
    };
  }

  static async getStories(token, location = 0) {
    const endpoint = `${API_CONFIG.ENDPOINTS.STORIES}?location=${location}`;
    try {
      const result = await this.request(endpoint, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      
      // Handle offline response
      if (this.isOfflineResponse(result)) {
        console.log('Returning offline stories data');
        return result;
      }
      
      return result;
    } catch (error) {
      // If we're offline, return offline structure
      if (!navigator.onLine) {
        return this.createOfflineResponse();
      }
      throw error;
    }
  }

  static async addStory(token, formData) {
    // Don't cache POST requests - always try to send when online
    if (!navigator.onLine) {
      throw new Error('Cannot add story while offline. Please check your internet connection.');
    }
    
    return this.request(API_CONFIG.ENDPOINTS.STORIES, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`
      },
      body: formData
    });
  }

  static async login(email, password) {
    // Don't cache login requests
    if (!navigator.onLine) {
      throw new Error('Cannot login while offline. Please check your internet connection.');
    }
    
    return this.request(API_CONFIG.ENDPOINTS.LOGIN, {
      method: 'POST',
      body: { email, password }
    });
  }

  static async register(name, email, password) {
    // Don't cache register requests
    if (!navigator.onLine) {
      throw new Error('Cannot register while offline. Please check your internet connection.');
    }
    
    return this.request(API_CONFIG.ENDPOINTS.REGISTER, {
      method: 'POST',
      body: { name, email, password }
    });
  }

  // Helper method to check if response is from offline mode
  static isOfflineResponse(response) {
    return response && (response.offline === true || response.message === 'offline');
  }
}