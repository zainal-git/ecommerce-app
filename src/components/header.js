export class HeaderComponent {
  constructor() {
    this.element = document.createElement("header");
    this.element.setAttribute("role", "banner");
  }

  render() {
    const userInfo = JSON.parse(localStorage.getItem("userInfo") || "{}");

    this.element.innerHTML = `
      <nav class="navbar" role="navigation" aria-label="Main navigation">
        <div class="nav-brand">
          <h1>
            <a href="#/" class="nav-logo" aria-label="E-Commerce Home">
              🛍️ E-Commerce
            </a>
          </h1>
        </div>
        
        <ul class="nav-menu" role="menubar">
          <li role="none">
            <a href="#/" class="nav-link" role="menuitem" data-link>Home</a>
          </li>
          <li role="none">
            <a href="#/products" class="nav-link" role="menuitem" data-link>Products</a>
          </li>
          <li role="none">
            <a href="#/map" class="nav-link" role="menuitem" data-link>Store Map</a>
          </li>
          ${
            userInfo.name
              ? `
            <li role="none">
              <a href="#/add-product" class="nav-link" role="menuitem" data-link>Add Product</a>
            </li>
            <li role="none" class="nav-user">
              <span class="user-info">Welcome, ${userInfo.name}</span>
              <div class="notification-controls">
                <button id="notification-toggle" class="btn-notification" aria-label="Toggle notifications">
                  <span class="notification-icon">🔔</span>
                  <span class="notification-status">Enable</span>
                </button>
              </div>
              <button id="logout-btn" class="btn-logout" aria-label="Logout">Logout</button>
            </li>
          `
              : `
            <li role="none">
              <a href="#/login" class="nav-link" role="menuitem" data-link>Login</a>
            </li>
          `
          }
        </ul>
        
        <button class="nav-toggle" aria-label="Toggle navigation" aria-expanded="false">
          <span></span>
          <span></span>
          <span></span>
        </button>
      </nav>
    `;

    this.attachEventListeners();
    return this.element;
  }

  async attachEventListeners() {
    const logoutBtn = this.element.querySelector("#logout-btn");
    const navToggle = this.element.querySelector(".nav-toggle");
    const navMenu = this.element.querySelector(".nav-menu");
    const notificationToggle = this.element.querySelector(
      "#notification-toggle"
    );

    if (logoutBtn) {
      logoutBtn.addEventListener("click", this.handleLogout);
    }

    if (navToggle) {
      navToggle.addEventListener("click", () => {
        const expanded = navToggle.getAttribute("aria-expanded") === "true";
        navToggle.setAttribute("aria-expanded", (!expanded).toString());
        navMenu.classList.toggle("active");
      });
    }

    if (notificationToggle) {
      // Load initial notification status
      await this.updateNotificationToggle();

      notificationToggle.addEventListener("click", () => {
        this.handleNotificationToggle();
      });
    }
  }

  async updateNotificationToggle() {
    const toggle = this.element.querySelector("#notification-toggle");
    const status = this.element.querySelector(".notification-status");
    const icon = this.element.querySelector(".notification-icon");

    if (!toggle) return;

    try {
      // Dynamic import untuk menghindari circular dependencies
      const { NotificationService } = await import(
        "../utils/notification-service.js"
      );
      const subscriptionStatus =
        await NotificationService.getSubscriptionStatus();

      if (!subscriptionStatus.supported) {
        toggle.disabled = true;
        status.textContent = "Unsupported";
        icon.textContent = "🔕";
        toggle.title = "Push notifications not supported in this browser";
        return;
      }

      if (subscriptionStatus.permission === "denied") {
        toggle.disabled = true;
        status.textContent = "Blocked";
        icon.textContent = "🔕";
        toggle.title =
          "Notification permission is blocked. Please enable in browser settings.";
        return;
      }

      if (subscriptionStatus.subscribed) {
        status.textContent = "Disable";
        icon.textContent = "🔔";
        toggle.setAttribute("aria-pressed", "true");
        toggle.title = "Click to disable push notifications";
      } else {
        status.textContent = "Enable";
        icon.textContent = "🔕";
        toggle.setAttribute("aria-pressed", "false");
        toggle.title = "Click to enable push notifications";
      }
    } catch (error) {
      console.error("Error updating notification toggle:", error);
      status.textContent = "Error";
      icon.textContent = "❌";
      toggle.title = "Error checking notification status";
    }
  }

  async handleNotificationToggle() {
    const toggle = this.element.querySelector("#notification-toggle");
    const status = this.element.querySelector(".notification-status");
    const icon = this.element.querySelector(".notification-icon");

    if (!toggle) return;

    toggle.disabled = true;

    try {
      const { NotificationService } = await import(
        "../utils/notification-service.js"
      );
      const subscriptionStatus =
        await NotificationService.getSubscriptionStatus();

      if (subscriptionStatus.subscribed) {
        // Unsubscribe
        await NotificationService.unsubscribeFromPushNotifications();
        status.textContent = "Enable";
        icon.textContent = "🔕";
        toggle.setAttribute("aria-pressed", "false");

        // Show confirmation
        NotificationService.showLocalNotification("Notifications Disabled", {
          body: "You will no longer receive push notifications",
          icon: "/icons/icon-192x192.png",
        });
      } else {
        // Subscribe
        await NotificationService.subscribeToPushNotifications();
        status.textContent = "Disable";
        icon.textContent = "🔔";
        toggle.setAttribute("aria-pressed", "true");

        // Show welcome notification
        NotificationService.showLocalNotification("Notifications Enabled", {
          body: "You will now receive push notifications from our store",
          icon: "/icons/icon-192x192.png",
          data: { url: window.location.href },
        });
      }
    } catch (error) {
      console.error("Error toggling notifications:", error);

      // Show error notification
      if (Notification.permission === "granted") {
        NotificationService.showLocalNotification("Notification Error", {
          body: error.message,
          icon: "/icons/icon-192x192.png",
        });
      } else {
        // Fallback alert if notifications are blocked
        alert(`Notification Error: ${error.message}`);
      }
    } finally {
      toggle.disabled = false;
      // Update status again to reflect any changes
      await this.updateNotificationToggle();
    }
  }

  handleLogout() {
    localStorage.removeItem("authToken");
    localStorage.removeItem("userInfo");
    window.location.hash = "/";
    window.location.reload();
  }
}
