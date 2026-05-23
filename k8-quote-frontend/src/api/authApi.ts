import axios from 'axios';
import { BASE_URL } from "../constants/constants";

class ApiService {
  private client: any;

  constructor() {
    this.client = axios.create({
      baseURL: BASE_URL,
      timeout: 10000,
      headers: {
        'Content-Type': 'application/json',
      },
    });
  }

  setToken(token: string) {
    localStorage.setItem('jwt_token', token);
    this.client.defaults.headers.common['Authorization'] = `Bearer ${token}`;
  }

  clearToken() {
    localStorage.removeItem('jwt_token');
    delete this.client.defaults.headers.common['Authorization'];
  }

  getToken(): string | null {
    return localStorage.getItem('jwt_token');
  }

  // Authentication endpoints
  async login(username: string, password: string) {
    const response = await this.client.post('/auth/login', { loginIdentifier: username, password });
    this.setToken(response.data.token);
    return response.data;
  }

  async register(userData: {
    email: string;
    username: string;
    password: string;
    confirmPassword: string;
  }) {
    const response = await this.client.post('/auth/register', userData);
    // Don't set token on registration - user should login separately
    return response.data;
  }

  async changePassword(oldPassword: string, newPassword: string) {
    return this.client.post('/auth/change-password', {
      oldPassword,
      newPassword,
    });
  }

  async unregister(password: string) {
    return this.client.post('/auth/unregister', { password });
  }

  // Admin endpoints (require admin role)
  async adminGetAllUsers() {
    const response = await this.client.get('/manage/users');
    return response.data;
  }

  async adminGetUserById(userId: string) {
    const response = await this.client.get(`/admin/users/${userId}`);
    return response.data;
  }

  async adminUpdateUserRole(userId: string, role: string) {
    const response = await this.client.post('/manage/users/role', {
      userId,
      role,
    });
    return response.data;
  }

  async adminRemoveUserRole(userId: string, role: string) {
    const response = await this.client.post('/manage/users/role', {
      userId,
      role,
      remove: true,
    });
    return response.data;
  }

  async adminGetAllQuotes() {
    const response = await this.client.get('/manage/quotes');
    return response.data;
  }

  async adminAddQuote(quote: { text: string; author: string }) {
    const response = await this.client.post('/manage/quotes/fetch', quote);
    return response.data;
  }

  async adminUpdateQuote(id: number, quote: { text: string; author: string }) {
    const response = await this.client.put(`/manage/quotes/${id}`, quote);
    return response.data;
  }

  async adminDeleteQuote(id: number) {
    const response = await this.client.delete(`/manage/quotes/${id}`);
    return response.data;
  }

  async adminGetStats() {
    const response = await this.client.get('/manage/stats');
    return response.data;
  }
}

// Create and export a singleton instance
const apiService = new ApiService();

// Set token from localStorage if it exists
const token = apiService.getToken();
if (token) {
  apiService.setToken(token);
}

export default apiService;