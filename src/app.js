import { HomeView } from "./views/home-view.js";
import { ProductsView } from "./views/products-view.js";
import { MapView } from "./views/map-view.js";
import { AddProductView } from "./views/add-product-view.js";
import { LoginView } from "./views/login-view.js";
import { HeaderComponent } from "./components/header.js";
import { FooterComponent } from "./components/footer.js";
import { ViewTransition } from "./utils/view-transition.js";
import { AuthService } from "./utils/auth.js";

export class App {
  constructor() {
    this.currentView = null;
    this.routes = {
      "/": HomeView,
      "/products": ProductsView,
      "/map": MapView,
      "/add-product": AddProductView,
      "/login": LoginView,
    };
  }

  async init() {
    await this.renderHeader();
    await this.renderFooter();
    this.setupRouter();
    this.setupSkipLink();
    this.setupKeyboardNavigation(); // ADD THIS
  }

  async renderHeader() {
    const headerContainer = document.getElementById("app-header"); // CHANGED ID
    const headerComponent = new HeaderComponent();
    headerContainer.appendChild(headerComponent.render());
  }

  async renderFooter() {
    const footerContainer = document.getElementById("app-footer"); // CHANGED ID
    const footerComponent = new FooterComponent();
    footerContainer.appendChild(footerComponent.render());
  }

  setupRouter() {
    // Handle initial route
    this.handleRouteChange();

    // Handle hash changes
    window.addEventListener("hashchange", () => {
      this.handleRouteChange();
    });

    // Handle link clicks for SPA navigation
    document.addEventListener("click", (e) => {
      const link = e.target.closest("a[data-link]");
      if (link) {
        e.preventDefault();
        const href = link.getAttribute("href");
        if (href && href.startsWith("#")) {
          window.location.hash = href.substring(1);
        }
      }
    });
  }

  // ADD THIS METHOD for keyboard navigation
  setupKeyboardNavigation() {
    document.addEventListener("keydown", (e) => {
      // Tab key navigation
      if (e.key === "Tab") {
        document.body.classList.add("keyboard-navigation");
      }
    });

    document.addEventListener("mousedown", () => {
      document.body.classList.remove("keyboard-navigation");
    });
  }

  async handleRouteChange() {
    const hash = window.location.hash.substring(1) || "/";
    const ViewClass = this.routes[hash];

    if (!ViewClass) {
      this.show404();
      return;
    }

    // Check authentication for protected routes
    if (
      (hash === "/products" || hash === "/map" || hash === "/add-product") &&
      !AuthService.isAuthenticated()
    ) {
      window.location.hash = "/login";
      return;
    }

    await this.renderView(ViewClass);
  }

  async renderView(ViewClass) {
    const viewContainer = document.getElementById("view-container");

    // Clean up current view
    if (this.currentView && this.currentView.destroy) {
      this.currentView.destroy();
    }

    // Start view transition
    await ViewTransition.start();

    // Create and render new view
    this.currentView = new ViewClass();
    viewContainer.innerHTML = "";
    const viewElement = await this.currentView.render();
    viewContainer.appendChild(viewElement);

    // Update skip link target
    this.updateSkipLink();

    // Focus management for accessibility
    this.manageFocus();
  }

  // ADD THIS METHOD for focus management
  manageFocus() {
    const mainHeading = document.querySelector("h1");
    if (mainHeading) {
      mainHeading.setAttribute("tabindex", "-1");
      mainHeading.focus();
    }
  }

  show404() {
    const viewContainer = document.getElementById("view-container");
    viewContainer.innerHTML = `
      <div class="view error-view">
        <section class="error-section" aria-labelledby="error-title">
          <h1 id="error-title">404 - Page Not Found</h1>
          <p>The page you're looking for doesn't exist.</p>
          <a href="#/" class="btn btn-primary" data-link>Go Home</a>
        </section>
      </div>
    `;
  }

  setupSkipLink() {
    const skipLink = document.querySelector(".skip-link");
    skipLink.addEventListener("click", (e) => {
      e.preventDefault();
      const mainContent = document.getElementById("main-content");
      mainContent.focus();
      mainContent.scrollIntoView({ behavior: "smooth" });
    });

    // Add keyboard event for skip link
    skipLink.addEventListener("keydown", (e) => {
      if (e.key === "Enter") {
        e.preventDefault();
        const mainContent = document.getElementById("main-content");
        mainContent.focus();
        mainContent.scrollIntoView({ behavior: "smooth" });
      }
    });
  }

  updateSkipLink() {
    const skipLink = document.querySelector(".skip-link");
    const firstHeading = document.querySelector('h1, h2, [role="main"] h1');
    if (firstHeading) {
      skipLink.setAttribute("href", `#${firstHeading.id}`);
    }
  }
}
