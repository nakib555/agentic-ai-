/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { toast } from 'sonner';
import { getApiBaseUrl } from '../utils/api';

export interface ApiRequestOptions extends RequestInit {
  silent?: boolean;
  params?: Record<string, string>;
}

class ApiClient {
  private onVersionMismatch?: () => void;

  constructor() {
  }

  setVersionMismatchHandler(handler: () => void) {
    this.onVersionMismatch = handler;
  }

  private async request<T>(endpoint: string, options: ApiRequestOptions = {}): Promise<T> {
    const { silent, params, ...fetchOptions } = options;
    
    const baseUrl = getApiBaseUrl();
    let url = `${baseUrl}${endpoint}`;
    if (params) {
      const searchParams = new URLSearchParams(params);
      url += `?${searchParams.toString()}`;
    }

    const headers = new Headers(fetchOptions.headers || {});
    headers.set('Content-Type', 'application/json');
    headers.set('X-Client-Version', process.env.APP_VERSION || '1.0.0');

    try {
      const response = await fetch(url, {
        ...fetchOptions,
        headers,
      });

      if (response.status === 409) {
        this.onVersionMismatch?.();
      }

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || `HTTP error! status: ${response.status}`);
      }

      if (response.status === 204) return {} as T;
      return await response.json();
    } catch (error: any) {
      if (!silent) {
        toast.error(error.message || 'An unexpected error occurred');
      }
      throw error;
    }
  }

  get<T>(endpoint: string, options?: ApiRequestOptions) {
    return this.request<T>(endpoint, { ...options, method: 'GET' });
  }

  post<T>(endpoint: string, body?: any, options?: ApiRequestOptions) {
    return this.request<T>(endpoint, { 
      ...options, 
      method: 'POST', 
      body: body ? JSON.stringify(body) : undefined 
    });
  }

  put<T>(endpoint: string, body?: any, options?: ApiRequestOptions) {
    return this.request<T>(endpoint, { 
      ...options, 
      method: 'PUT', 
      body: body ? JSON.stringify(body) : undefined 
    });
  }

  delete<T>(endpoint: string, options?: ApiRequestOptions) {
    return this.request<T>(endpoint, { ...options, method: 'DELETE' });
  }
}

export const apiClient = new ApiClient();
