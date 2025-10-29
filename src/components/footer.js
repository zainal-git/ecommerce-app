export class FooterComponent {
  constructor() {
    this.element = document.createElement('footer');
    this.element.setAttribute('role', 'contentinfo');
  }

  render() {
    this.element.innerHTML = `
      <div class="footer-content">
        <p>&copy; 2025 E-Commerce App.</p>
        <p>jeje-zainn</p>
      </div>
    `;
    return this.element;
  }
}