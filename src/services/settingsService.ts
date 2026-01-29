
/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { fetchFromApi } from '../utils/api';
import type { Model } from '../types';

export type AppSettings = {
    provider: 'gemini' | 'openrouter' | 'ollama';
    apiKey: string;
    openRouterApiKey: string;
    ollamaApiKey?: string; // Optional dedicated key for Ollama
    ollamaHost: string;
    aboutUser: string;
    aboutResponse: string;
    temperature: number;
    maxTokens: number;
    imageModel: string;
    videoModel: string;
    isMemoryEnabled: boolean;
    ttsVoice: string;
    ttsModel: string; 
    isAgentMode: boolean;
    activeModel: string;
};

export type UpdateSettingsResponse = AppSettings & {
    models?: Model[];
    imageModels?: Model[];
    videoModels?: Model[];
    ttsModels?: Model[]; 
};

export const getSettings = async (): Promise<AppSettings> => {
    const response = await fetchFromApi('/api/settings');
    if (!response.ok) {
        throw new Error('Failed to fetch settings');
    }
    
    // Robust check: Ensure we got JSON, not an HTML error page or fallback
    const contentType = response.headers.get("content-type");
    if (contentType && contentType.includes("text/html")) {
        throw new Error("Backend not connected (Received HTML).");
    }

    return response.json();
};

export const updateSettings = async (settings: Partial<AppSettings>): Promise<UpdateSettingsResponse> => {
    const body = JSON.stringify(settings);
    
    // keepalive has a 64KB limit. We use it for small payloads (like API keys) 
    // to ensure saving persists even if the tab is closed.
    // For larger payloads (like huge system prompts), we skip it to avoid network errors.
    const useKeepalive = new Blob([body]).size < 60000;

    const response = await fetchFromApi('/api/settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: body,
        keepalive: useKeepalive,
    });
    if (!response.ok) {
        const contentType = response.headers.get("content-type");
        if (contentType && contentType.includes("text/html")) {
            throw new Error("Backend not connected (Received HTML).");
        }
        
        const errorBody = await response.json().catch(() => ({ error: 'An unknown error occurred while saving settings.' }));
        throw new Error(errorBody.error);
    }
    return response.json();
};
