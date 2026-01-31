
/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * Determines the base URL for API requests based on the execution environment.
 */
export const getApiBaseUrl = (): string => {
    // 1. Build Configuration / Environment Variable (VITE_API_BASE_URL) - Highest Priority
    try {
        // @ts-ignore - Vite specific
        const envUrl = import.meta.env.VITE_API_BASE_URL;
        if (envUrl && typeof envUrl === 'string' && envUrl.trim() !== '') {
            return envUrl.replace(/\/$/, '');
        }
    } catch (e) {
        // Ignore if import.meta is not available or fails
    }

    // 2. Manual Override from LocalStorage (User Input)
    try {
        if (typeof window !== 'undefined') {
            const customUrl = localStorage.getItem('custom_server_url');
            if (customUrl) return customUrl.replace(/\/$/, '');
        }
    } catch (e) {}

    // 3. Default to Relative Path (Works for Prod Monolith AND Dev Proxy)
    return '';
};

export const isUsingCustomBaseUrl = (): boolean => {
    try {
        if (typeof window !== 'undefined') {
            return !!localStorage.getItem('custom_server_url');
        }
    } catch (e) {}
    return false;
};

export const resetApiBaseUrl = () => {
    try {
        if (typeof window !== 'undefined') {
            localStorage.removeItem('custom_server_url');
            window.location.reload();
        }
    } catch (e) {}
};

// Global callback for version mismatch
let onVersionMismatch = () => {};
export const setOnVersionMismatch = (callback: () => void) => {
    onVersionMismatch = callback;
};

type ApiOptions = RequestInit & { silent?: boolean; timeout?: number };

/**
 * Enhanced fetch wrapper for API calls with automatic base URL, timeout, and error handling.
 */
export const fetchFromApi = async (url: string, options: ApiOptions = {}): Promise<Response> => {
    const baseUrl = getApiBaseUrl();
    const fullUrl = `${baseUrl}${url}`;
    const method = options.method || 'GET';
    const { silent, timeout = 60000, ...fetchOptions } = options; // Default 60s timeout
    
    // Log the effective URL for debugging
    if (!silent) {
        console.log(`[API] Requesting: ${method} ${fullUrl}`);
    }

    // Get version from safe source
    let appVersion = 'unknown';
    try {
        const meta = import.meta as any;
        appVersion = meta.env?.VITE_APP_VERSION || 'unknown';
    } catch (e) {}
    
    const headers: HeadersInit = {
        'Content-Type': 'application/json',
        'X-Client-Version': appVersion,
        ...fetchOptions.headers,
    };
    
    // Setup Timeout
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeout);
    
    // Allow user-provided signal to override internal timeout signal if needed, 
    // or merge them (complex), but for simplicity we assume if signal is passed, caller handles timeout.
    const signal = fetchOptions.signal || controller.signal;

    try {
        const response = await fetch(fullUrl, { ...fetchOptions, headers, signal });
        clearTimeout(timeoutId);
        
        if (response.status === 409) {
            console.warn(`[API Warning] ⚠️ Version mismatch detected for ${url}`);
            onVersionMismatch();
            throw new Error('Version mismatch');
        }

        if (!response.ok && !silent) {
            console.error(`[API Error] ❌ ${method} ${fullUrl} failed with status ${response.status}`);
            try {
                // Clone to not consume body if caller needs it (though usually we throw here)
                const errorClone = response.clone();
                const errorText = await errorClone.text();
                // Attempt to parse json for cleaner log
                try {
                    console.dir(JSON.parse(errorText));
                } catch {
                    console.error('Response body:', errorText);
                }
            } catch (e) {}
        }
        
        return response;
    } catch (error: any) {
        clearTimeout(timeoutId);
        
        if (!silent) {
            if (error.name === 'AbortError') {
                 console.warn(`[API] ⏱️ Request timed out: ${method} ${fullUrl}`);
                 throw new Error('Request timed out. The server took too long to respond.');
            } else {
                 console.error(`[API Fatal] 💥 ${method} ${fullUrl} request failed`, error);
            }
        }
        
        // Normalize network errors
        if (error.name === 'TypeError' && error.message === 'Failed to fetch') {
             throw new Error(`Network error: Could not connect to server at ${fullUrl}. Please check your connection and the server URL in Settings.`);
        }
        
        throw error;
    }
};
