export class AuthService {
  static getToken() {
    return localStorage.getItem("authToken");
  }

  static setToken(token) {
    localStorage.setItem("authToken", token);
  }

  static removeToken() {
    localStorage.removeItem("authToken");
  }

  static isAuthenticated() {
    return !!this.getToken();
  }

  static getUserInfo() {
    const user = localStorage.getItem("userInfo");
    return user ? JSON.parse(user) : null;
  }

  static setUserInfo(user) {
    localStorage.setItem("userInfo", JSON.stringify(user));
  }

  static logout() {
    this.removeToken();
    localStorage.removeItem("userInfo");
  }
}
