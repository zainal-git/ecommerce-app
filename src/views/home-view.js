import { ViewTransition } from "../utils/view-transition.js";

export class HomeView {
  constructor() {
    this.element = document.createElement("div");
    this.element.className = "view home-view";
    this.element.setAttribute("role", "main");
    this.element.setAttribute("aria-label", "Home Page");
  }

  async render() {
    this.element.innerHTML = `
      <section class="hero" aria-labelledby="hero-title">
        <div class="hero-content">
          <h1 id="hero-title">Welcome to Our E-Commerce Store</h1>
          <p class="hero-description">Discover amazing products at great prices. Shop with confidence and convenience.</p>
          <div class="hero-actions">
            <a href="#/products" class="btn btn-primary" data-link>Shop Now</a>
            <a href="#/map" class="btn btn-secondary" data-link>Find Stores</a>
          </div>
        </div>
        <div class="hero-image">
          <img src="https://images.unsplash.com/photo-1556742049-0cfed4f6a45d?w=500&auto=format&fit=crop" alt="Shopping experience" loading="lazy">
        </div>
      </section>

      <section class="features" aria-labelledby="features-title">
        <h2 id="features-title" class="section-title">Why Shop With Us?</h2>
        <div class="features-grid">
          <div class="feature-card" role="article">
            <div class="feature-icon">🚚</div>
            <h3>Fast Delivery</h3>
            <p>Get your products delivered quickly and safely to your doorstep.</p>
          </div>
          <div class="feature-card" role="article">
            <div class="feature-icon">💳</div>
            <h3>Secure Payment</h3>
            <p>Multiple payment options with bank-level security.</p>
          </div>
          <div class="feature-card" role="article">
            <div class="feature-icon">⭐</div>
            <h3>Quality Products</h3>
            <p>Carefully curated products from trusted sellers.</p>
          </div>
        </div>
      </section>
    `;

    await ViewTransition.fadeIn(this.element);
    return this.element;
  }
}
