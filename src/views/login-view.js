import { ApiService } from "../config/api.js";
import { AuthService } from "../utils/auth.js";
import { ViewTransition } from "../utils/view-transition.js";

export class LoginView {
  constructor() {
    this.element = document.createElement("div");
    this.element.className = "view login-view";
    this.element.setAttribute("role", "main");
    this.element.setAttribute("aria-label", "Login Page");
    this.isLoginMode = true;
  }

  async render() {
    this.element.innerHTML = `
      <section class="auth-section" aria-labelledby="auth-title">
        <div class="auth-container">
          <h1 id="auth-title">${this.isLoginMode ? "Login" : "Register"}</h1>
          
          <form id="auth-form" class="auth-form" novalidate>
            ${
              !this.isLoginMode
                ? `
              <div class="form-group">
                <label for="name" class="form-label">Full Name *</label>
                <input 
                  type="text" 
                  id="name" 
                  name="name" 
                  class="form-input" 
                  required 
                  aria-required="true"
                  aria-describedby="name-error"
                >
                <div id="name-error" class="error-text" role="alert" aria-live="polite"></div>
              </div>
            `
                : ""
            }
            
            <div class="form-group">
              <label for="email" class="form-label">Email *</label>
              <input 
                type="email" 
                id="email" 
                name="email" 
                class="form-input" 
                required 
                aria-required="true"
                aria-describedby="email-error"
              >
              <div id="email-error" class="error-text" role="alert" aria-live="polite"></div>
            </div>

            <div class="form-group">
              <label for="password" class="form-label">Password *</label>
              <input 
                type="password" 
                id="password" 
                name="password" 
                class="form-input" 
                required 
                aria-required="true"
                minlength="8"
                aria-describedby="password-error"
              >
              <div id="password-error" class="error-text" role="alert" aria-live="polite"></div>
              ${
                !this.isLoginMode
                  ? `
                <div class="help-text">Password must be at least 8 characters long</div>
              `
                  : ""
              }
            </div>

            <button type="submit" class="btn btn-primary btn-block" id="submit-btn">
              ${this.isLoginMode ? "Login" : "Register"}
            </button>

            <div class="auth-switch">
              <p>
                ${
                  this.isLoginMode
                    ? "Don't have an account? "
                    : "Already have an account? "
                }
                <button type="button" id="switch-mode" class="link-button">
                  ${this.isLoginMode ? "Register here" : "Login here"}
                </button>
              </p>
            </div>

            <div id="auth-message" role="alert" aria-live="assertive"></div>
          </form>
        </div>
      </section>
    `;

    this.attachEventListeners();
    await ViewTransition.fadeIn(this.element);
    return this.element;
  }

  attachEventListeners() {
    const form = this.element.querySelector("#auth-form");
    const switchModeBtn = this.element.querySelector("#switch-mode");

    form.addEventListener("submit", (e) => {
      e.preventDefault();
      this.handleAuth();
    });

    switchModeBtn.addEventListener("click", () => {
      this.isLoginMode = !this.isLoginMode;
      this.render();
    });
  }

  async handleAuth() {
    const form = this.element.querySelector("#auth-form");
    const submitBtn = this.element.querySelector("#submit-btn");
    const formData = new FormData(form);

    if (!this.validateForm()) {
      return;
    }

    try {
      submitBtn.disabled = true;
      submitBtn.textContent = this.isLoginMode
        ? "Logging in..."
        : "Registering...";

      const email = formData.get("email");
      const password = formData.get("password");

      let response;
      if (this.isLoginMode) {
        response = await ApiService.login(email, password);
      } else {
        const name = formData.get("name");
        response = await ApiService.register(name, email, password);

        if (!response.error) {
          // Auto login after registration
          response = await ApiService.login(email, password);
        }
      }

      if (response.loginResult) {
        AuthService.setToken(response.loginResult.token);
        AuthService.setUserInfo({
          userId: response.loginResult.userId,
          name: response.loginResult.name,
        });

        this.showMessage(
          this.isLoginMode ? "Login successful!" : "Registration successful!",
          "success"
        );

        setTimeout(() => {
          window.location.hash = "/products";
        }, 1000);
      }
    } catch (error) {
      this.showMessage(error.message, "error");
    } finally {
      submitBtn.disabled = false;
      submitBtn.textContent = this.isLoginMode ? "Login" : "Register";
    }
  }

  validateForm() {
    let isValid = true;
    this.clearErrors();

    if (!this.isLoginMode) {
      const name = this.element.querySelector("#name").value.trim();
      if (!name) {
        this.showError("name", "Full name is required");
        isValid = false;
      }
    }

    const email = this.element.querySelector("#email").value.trim();
    if (!email) {
      this.showError("email", "Email is required");
      isValid = false;
    } else if (!this.isValidEmail(email)) {
      this.showError("email", "Please enter a valid email address");
      isValid = false;
    }

    const password = this.element.querySelector("#password").value;
    if (!password) {
      this.showError("password", "Password is required");
      isValid = false;
    } else if (!this.isLoginMode && password.length < 8) {
      this.showError("password", "Password must be at least 8 characters long");
      isValid = false;
    }

    return isValid;
  }

  isValidEmail(email) {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  }

  showError(fieldId, message) {
    const errorElement = this.element.querySelector(`#${fieldId}-error`);
    if (errorElement) {
      errorElement.textContent = message;
    }
  }

  clearErrors() {
    const errorElements = this.element.querySelectorAll(".error-text");
    errorElements.forEach((element) => {
      element.textContent = "";
    });
  }

  showMessage(message, type) {
    const messageElement = this.element.querySelector("#auth-message");
    messageElement.textContent = message;
    messageElement.className = `auth-message ${type}`;
    messageElement.hidden = false;

    setTimeout(() => {
      messageElement.hidden = true;
    }, 5000);
  }
}
