import { useAuthStore } from '@/stores/authStore';

// Automatically detect the correct API base URL
const getApiBaseUrl = () => {
  // If we have an explicit API URL set, use it
  if (process.env.NEXT_PUBLIC_API_URL) {
    return process.env.NEXT_PUBLIC_API_URL;
  }
  
  // In browser environment
  if (typeof window !== 'undefined') {
    // If we're on Railway or production domain, use the current origin
    const hostname = window.location.hostname;
    if (hostname.includes('.up.railway.app') || 
        hostname.includes('buildaneural.net') || 
        hostname.includes('buildaneuralnet')) {
      return window.location.origin;
    }
  }
  
  // Default to local development
  return 'http://localhost:8000';
};

const API_BASE_URL = getApiBaseUrl();

// Debug logging in development
if (typeof window !== 'undefined' && process.env.NODE_ENV === 'development') {
  console.log('API Base URL:', API_BASE_URL);
}

// Security constants
const REQUEST_TIMEOUT = 10000; // 10 seconds
const MAX_RETRY_ATTEMPTS = 3;
const RATE_LIMIT_DELAY = 1000; // 1 second between requests

interface ApiError {
  detail: string;
  status: number;
}

interface RateLimitState {
  lastRequest: number;
  requestCount: number;
  windowStart: number;
}

class SecurityUtils {
  /**
   * Sanitize input to prevent XSS and injection attacks
   */
  static sanitizeInput(input: any): any {
    if (typeof input === 'string') {
      return input
        .replace(/[<>'"]/g, '') // Remove dangerous characters
        .trim()
        .slice(0, 10000); // Limit length
    }
    
    if (Array.isArray(input)) {
      return input.map(item => SecurityUtils.sanitizeInput(item));
    }
    
    if (typeof input === 'object' && input !== null) {
      const sanitized: any = {};
      for (const [key, value] of Object.entries(input)) {
        // Only allow safe keys
        if (/^[a-zA-Z0-9_-]+$/.test(key)) {
          sanitized[key] = SecurityUtils.sanitizeInput(value);
        }
      }
      return sanitized;
    }
    
    return input;
  }

  /**
   * Validate email format
   */
  static isValidEmail(email: string): boolean {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email) && email.length <= 255;
  }

  /**
   * Validate password strength
   */
  static validatePassword(password: string): { isValid: boolean; errors: string[] } {
    const errors: string[] = [];
    
    if (password.length < 8) {
      errors.push('Password must be at least 8 characters long');
    }
    
    if (!/[A-Z]/.test(password)) {
      errors.push('Password must contain at least one uppercase letter');
    }
    
    if (!/[a-z]/.test(password)) {
      errors.push('Password must contain at least one lowercase letter');
    }
    
    if (!/\d/.test(password)) {
      errors.push('Password must contain at least one number');
    }
    
    if (!/[!@#$%^&*(),.?":{}|<>]/.test(password)) {
      errors.push('Password must contain at least one special character');
    }
    
    return {
      isValid: errors.length === 0,
      errors
    };
  }

  /**
   * Generate CSRF token for requests
   */
  static generateCSRFToken(): string {
    const array = new Uint8Array(32);
    crypto.getRandomValues(array);
    return Array.from(array, byte => byte.toString(16).padStart(2, '0')).join('');
  }

  /**
   * Validate response content type
   */
  static isValidContentType(contentType: string): boolean {
    const allowedTypes = [
      'application/json',
      'text/plain',
      'multipart/form-data'
    ];
    return allowedTypes.some(type => contentType.includes(type));
  }
}

class RateLimiter {
  private state: RateLimitState = {
    lastRequest: 0,
    requestCount: 0,
    windowStart: Date.now()
  };
  
  private readonly maxRequests = 60; // per minute
  private readonly windowMs = 60000; // 1 minute

  async checkRateLimit(): Promise<void> {
    const now = Date.now();
    
    // Reset window if expired
    if (now - this.state.windowStart >= this.windowMs) {
      this.state.windowStart = now;
      this.state.requestCount = 0;
    }
    
    // Check if rate limit exceeded
    if (this.state.requestCount >= this.maxRequests) {
      const waitTime = this.windowMs - (now - this.state.windowStart);
      throw new Error(`Rate limit exceeded. Please wait ${Math.ceil(waitTime / 1000)} seconds.`);
    }
    
    // Enforce minimum delay between requests
    const timeSinceLastRequest = now - this.state.lastRequest;
    if (timeSinceLastRequest < RATE_LIMIT_DELAY) {
      await new Promise(resolve => 
        setTimeout(resolve, RATE_LIMIT_DELAY - timeSinceLastRequest)
      );
    }
    
    this.state.requestCount++;
    this.state.lastRequest = now;
  }
}

class ApiClient {
  private baseURL: string;
  private rateLimiter: RateLimiter;
  private csrfToken: string;

  constructor(baseURL: string) {
    this.baseURL = baseURL;
    this.rateLimiter = new RateLimiter();
    this.csrfToken = SecurityUtils.generateCSRFToken();
  }

  private async refreshTokens(): Promise<boolean> {
    const { refreshToken, updateTokens, logout } = useAuthStore.getState();
    
    if (!refreshToken) {
      console.log('No refresh token available');
      return false;
    }

    console.log('Attempting to refresh tokens...');
    try {
      const response = await fetch(`${this.baseURL}/auth/refresh`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-CSRF-Token': this.csrfToken,
        },
        body: JSON.stringify({ refresh_token: refreshToken }),
      });

      console.log('Token refresh response:', response.status, response.statusText);

      if (response.ok) {
        // Validate content type
        const contentType = response.headers.get('content-type') || '';
        if (!SecurityUtils.isValidContentType(contentType)) {
          console.error('Invalid content type in refresh response');
          return false;
        }
        
        const data = await response.json();
        console.log('Token refresh successful, updating tokens');
        updateTokens(data.access_token, data.refresh_token);
        return true;
      } else {
        console.log('Token refresh failed with status:', response.status);
        const errorData = await response.json().catch(() => ({}));
        console.log('Token refresh error details:', errorData);
        logout(); // Auto-logout on refresh failure
      }
    } catch (error) {
      console.error('Token refresh failed:', error);
      logout(); // Auto-logout on refresh failure
    }

    return false;
  }

  private async makeRequest(
    url: string,
    options: RequestInit = {},
    isRetry = false
  ): Promise<Response> {
    // Apply rate limiting
    await this.rateLimiter.checkRateLimit();

    const { accessToken, logout } = useAuthStore.getState();

    const headers = new Headers(options.headers);
    headers.set('Content-Type', 'application/json');
    headers.set('X-CSRF-Token', this.csrfToken);
    headers.set('X-Requested-With', 'XMLHttpRequest'); // CSRF protection

    if (accessToken) {
      headers.set('Authorization', `Bearer ${accessToken}`);
      console.log(`Making request to ${url} with token:`, accessToken.substring(0, 20) + '...');
    } else {
      console.log(`Making request to ${url} without token`);
    }

    // Add timeout to prevent hanging requests
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), REQUEST_TIMEOUT);

    try {
      const response = await fetch(`${this.baseURL}${url}`, {
        ...options,
        headers,
        signal: controller.signal,
        // Security: Ensure credentials are only sent to same origin
        credentials: this.baseURL.includes(window.location.hostname) ? 'include' : 'omit',
      });

      clearTimeout(timeoutId);
      console.log(`Response from ${url}:`, response.status, response.statusText);

      // Validate response content type
      const contentType = response.headers.get('content-type') || '';
      if (response.ok && !SecurityUtils.isValidContentType(contentType)) {
        throw new Error('Invalid response content type');
      }

      // Handle token expiration
      if (response.status === 401 && !isRetry && accessToken) {
        console.log('401 error detected, attempting token refresh...');
        const refreshed = await this.refreshTokens();
        
        if (refreshed) {
          console.log('Token refresh successful, retrying request...');
          // Retry the request with new token
          return this.makeRequest(url, options, true);
        } else {
          console.log('Token refresh failed, logging out...');
          // Refresh failed, logout
          logout();
        }
      }

      return response;
    } catch (error) {
      clearTimeout(timeoutId);
      if (error instanceof Error && error.name === 'AbortError') {
        console.log(`Request to ${url} timed out after ${REQUEST_TIMEOUT}ms`);
        throw new Error(`Request timeout: ${url}`);
      }
      console.log(`Request to ${url} failed:`, error);
      throw error;
    }
  }

  async get(url: string) {
    const response = await this.makeRequest(url);
    if (!response.ok) throw await this.handleError(response);
    return response.json();
  }

  async post(url: string, data?: any) {
    // Sanitize input data
    const sanitizedData = data ? SecurityUtils.sanitizeInput(data) : undefined;
    
    const response = await this.makeRequest(url, {
      method: 'POST',
      body: sanitizedData ? JSON.stringify(sanitizedData) : undefined,
    });
    if (!response.ok) throw await this.handleError(response);
    return response.json();
  }

  async put(url: string, data?: any) {
    // Sanitize input data
    const sanitizedData = data ? SecurityUtils.sanitizeInput(data) : undefined;
    
    const response = await this.makeRequest(url, {
      method: 'PUT',
      body: sanitizedData ? JSON.stringify(sanitizedData) : undefined,
    });
    if (!response.ok) throw await this.handleError(response);
    return response.json();
  }

  async delete(url: string) {
    const response = await this.makeRequest(url, {
      method: 'DELETE',
    });
    if (!response.ok) throw await this.handleError(response);
    return response.json();
  }

  private async handleError(response: Response): Promise<ApiError> {
    let detail = 'An error occurred';
    
    try {
      const contentType = response.headers.get('content-type') || '';
      if (SecurityUtils.isValidContentType(contentType)) {
        const data = await response.json();
        detail = data.detail || data.message || detail;
      }
    } catch {
      // Response might not be JSON or might be malicious
      detail = `HTTP ${response.status}: ${response.statusText}`;
    }

    return {
      detail,
      status: response.status,
    };
  }

  // Auth specific methods with enhanced security
  async login(email: string, password: string) {
    // Validate inputs
    if (!SecurityUtils.isValidEmail(email)) {
      throw new Error('Invalid email format');
    }

    if (!password || password.length < 8) {
      throw new Error('Invalid password');
    }

    const formData = new FormData();
    formData.append('username', email); // OAuth2 expects 'username'
    formData.append('password', password);

    // Add CSRF protection
    const headers = new Headers();
    headers.set('X-CSRF-Token', this.csrfToken);
    headers.set('X-Requested-With', 'XMLHttpRequest');

    const response = await fetch(`${this.baseURL}/auth/login`, {
      method: 'POST',
      headers,
      body: formData,
      credentials: 'include',
    });

    if (!response.ok) throw await this.handleError(response);
    return response.json();
  }

  async register(email: string, username: string, password: string) {
    // Validate inputs
    if (!SecurityUtils.isValidEmail(email)) {
      throw new Error('Invalid email format');
    }

    if (!username || username.length < 3 || username.length > 50) {
      throw new Error('Username must be between 3 and 50 characters');
    }

    const passwordValidation = SecurityUtils.validatePassword(password);
    if (!passwordValidation.isValid) {
      throw new Error(passwordValidation.errors.join('; '));
    }

    // Sanitize inputs
    const sanitizedData = {
      email: email.toLowerCase().trim(),
      username: username.trim(),
      password: password
    };

    const response = await fetch(`${this.baseURL}/auth/register`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-CSRF-Token': this.csrfToken,
        'X-Requested-With': 'XMLHttpRequest',
      },
      body: JSON.stringify(sanitizedData),
      credentials: 'include',
    });

    if (!response.ok) {
      const error = await this.handleError(response);
      throw error;
    }
    return response.json();
  }

  async verifyEmail(token: string) {
    // Validate token format (should be URL-safe base64)
    if (!/^[A-Za-z0-9_-]+$/.test(token) || token.length < 20) {
      throw new Error('Invalid verification token format');
    }
    
    return this.post('/auth/verify-email', { token });
  }

  async getCurrentUser() {
    return this.get('/auth/me');
  }

  // Model specific methods with validation
  async createModel(modelData: any) {
    // Validate model data structure
    if (!modelData.name || typeof modelData.name !== 'string') {
      throw new Error('Model name is required');
    }
    
    if (modelData.name.length > 255) {
      throw new Error('Model name too long');
    }

    return this.post('/models', modelData);
  }

  async getModels(skip = 0, limit = 20) {
    // Validate pagination parameters
    skip = Math.max(0, Math.min(skip, 10000));
    limit = Math.max(1, Math.min(limit, 100));
    
    return this.get(`/models?skip=${skip}&limit=${limit}`);
  }

  async getModel(id: string) {
    // Validate ID format (UUID)
    if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)) {
      throw new Error('Invalid model ID format');
    }
    
    return this.get(`/models/${id}`);
  }

  async updateModel(id: string, updates: any) {
    // Validate ID format
    if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)) {
      throw new Error('Invalid model ID format');
    }
    
    return this.put(`/models/${id}`, updates);
  }

  async deleteModel(id: string) {
    // Validate ID format
    if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)) {
      throw new Error('Invalid model ID format');
    }
    
    return this.delete(`/models/${id}`);
  }

  async autosaveModel(modelData: any) {
    // Rate limit autosave to prevent spam
    return this.post('/models/autosave', modelData);
  }

  // Code generation method
  async generateCode(modelId: string) {
    // Validate model ID format
    if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(modelId)) {
      throw new Error('Invalid model ID format');
    }
    
    return this.post(`/models/${modelId}/generate-code`, {});
  }


}

export const apiClient = new ApiClient(API_BASE_URL);
export const api = apiClient; // Export alias for backwards compatibility
export { SecurityUtils }; 