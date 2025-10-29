import { API_CONFIG } from "../config/api.js";

export class NotificationService {
  static async requestPermission() {
    if (!("Notification" in window)) {
      console.warn("This browser does not support notifications");
      return "unsupported";
    }

    if (Notification.permission === "granted") {
      return "granted";
    }

    if (Notification.permission === "denied") {
      console.warn("Notification permission was denied");
      return "denied";
    }

    try {
      const permission = await Notification.requestPermission();
      return permission;
    } catch (error) {
      console.error("Error requesting notification permission:", error);
      return "denied";
    }
  }

  static async registerServiceWorker() {
    if (!("serviceWorker" in navigator)) {
      throw new Error("Service workers are not supported");
    }

    try {
      const registration = await navigator.serviceWorker.register("/sw.js", {
        scope: "/",
      });

      console.log("Service Worker registered successfully");
      return registration;
    } catch (error) {
      console.error("Service Worker registration failed:", error);
      throw error;
    }
  }

  static async createPushSubscription(registration) {
    if (!("PushManager" in window)) {
      throw new Error("Push messaging is not supported");
    }

    const vapidPublicKey = this.getVapidPublicKey();
    const convertedVapidKey = this.urlBase64ToUint8Array(vapidPublicKey);

    try {
      const subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: convertedVapidKey,
      });

      return subscription;
    } catch (error) {
      if (Notification.permission === "denied") {
        throw new Error("Notification permission denied");
      } else {
        console.error("Error creating push subscription:", error);
        throw error;
      }
    }
  }

  static async subscribeToPushNotifications() {
    try {
      // 1. Request permission
      const permission = await this.requestPermission();
      if (permission !== "granted") {
        throw new Error("Notification permission not granted");
      }

      // 2. Register service worker
      const registration = await this.registerServiceWorker();

      // 3. Create push subscription
      const subscription = await this.createPushSubscription(registration);

      // 4. Send subscription to server
      const token = localStorage.getItem("authToken");
      if (!token) {
        throw new Error("User not authenticated");
      }

      const response = await fetch(
        `${API_CONFIG.BASE_URL}${API_CONFIG.ENDPOINTS.NOTIFICATIONS}`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({ subscription }),
        }
      );

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(
          errorData.message || "Failed to subscribe to notifications"
        );
      }

      console.log("Successfully subscribed to push notifications");
      return true;
    } catch (error) {
      console.error("Error subscribing to push notifications:", error);
      throw error;
    }
  }

  static async unsubscribeFromPushNotifications() {
    try {
      const registration = await navigator.serviceWorker.ready;
      const subscription = await registration.pushManager.getSubscription();

      if (subscription) {
        await subscription.unsubscribe();

        // Send unsubscribe to server
        const token = localStorage.getItem("authToken");
        if (token) {
          const response = await fetch(
            `${API_CONFIG.BASE_URL}${API_CONFIG.ENDPOINTS.NOTIFICATIONS}`,
            {
              method: "DELETE",
              headers: {
                Authorization: `Bearer ${token}`,
              },
            }
          );

          if (!response.ok) {
            console.warn(
              "Failed to unsubscribe from server, but local subscription removed"
            );
          }
        }

        console.log("Successfully unsubscribed from push notifications");
      }

      return true;
    } catch (error) {
      console.error("Error unsubscribing from push notifications:", error);
      throw error;
    }
  }

  static async getSubscriptionStatus() {
    if (!("serviceWorker" in navigator) || !("PushManager" in window)) {
      return { supported: false, subscribed: false };
    }

    try {
      const registration = await navigator.serviceWorker.ready;
      const subscription = await registration.pushManager.getSubscription();

      return {
        supported: true,
        subscribed: !!subscription,
        permission: Notification.permission,
      };
    } catch (error) {
      console.error("Error getting subscription status:", error);
      return { supported: false, subscribed: false };
    }
  }

  // Helper method to convert VAPID key
  static urlBase64ToUint8Array(base64String) {
    // Remove any whitespace and ensure proper base64 format
    const base64 = base64String
      .replace(/\s/g, "")
      .replace(/\-/g, "+")
      .replace(/_/g, "/");

    const padding = "=".repeat((4 - (base64.length % 4)) % 4);
    const base64WithPadding = base64 + padding;

    const rawData = atob(base64WithPadding);
    const outputArray = new Uint8Array(rawData.length);

    for (let i = 0; i < rawData.length; ++i) {
      outputArray[i] = rawData.charCodeAt(i);
    }
    return outputArray;
  }

  // Method untuk mendapatkan VAPID public key
  static getVapidPublicKey() {
    // VAPID public key dari yang Anda berikan
    return "BCCs2eonMI-6H2ctvFaWg-UYdDv387Vno_bzUzALpB442r2lCnsHmtrx8biyPi_E-1fSGABK_Qs_GlvPoJJqxbk";
  }

  // Method untuk menampilkan local notification (tanpa push)
  static showLocalNotification(title, options = {}) {
    if (!("Notification" in window) || Notification.permission !== "granted") {
      return false;
    }

    const notificationOptions = {
      icon: "/icons/icon-192x192.png",
      badge: "/icons/badge-72x72.png",
      ...options,
    };

    try {
      const notification = new Notification(title, notificationOptions);

      notification.onclick = () => {
        window.focus();
        if (options.data && options.data.url) {
          window.location.href = options.data.url;
        }
        notification.close();
      };

      return true;
    } catch (error) {
      console.error("Error showing local notification:", error);
      return false;
    }
  }
}
