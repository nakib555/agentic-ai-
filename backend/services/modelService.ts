

/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import type { Model as AppModel } from '../../src/types';
import { readData, SETTINGS_FILE_PATH } from '../data-store';
import { providerRegistry } from '../providers/registry';
import { ModelLists } from '../providers/types';

// Cache structure
type ModelCache = {
    keyHash: string;
    provider: string;
    data: ModelLists;
    timestamp: number;
};

let modelCache: ModelCache | null = null;
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes

export async function listAvailableModels(apiKey: string, forceRefresh = false, providerOverride?: string): Promise<ModelLists> {
    // Determine provider from override or settings
    let providerId = providerOverride;
    
    if (!providerId) {
        try {
            const settings: any = await readData(SETTINGS_FILE_PATH);
            providerId = settings.provider;
        } catch(e) {
            // ignore
        }
    }
    
    // Default to gemini if still undetermined
    providerId = providerId || 'gemini';
    
    // Hash key + provider + (optional) host to ensure cache validity
    let currentKeyHash = (apiKey || '').trim().slice(-8) + providerId;
    
    // For Ollama, include the host URL in the cache key.
    if (providerId === 'ollama') {
         try {
             const settings: any = await readData(SETTINGS_FILE_PATH);
             currentKeyHash += (settings.ollamaHost || '').trim();
         } catch(e) {}
    }
    
    const now = Date.now();

    // Check cache first
    if (
        !forceRefresh &&
        modelCache && 
        modelCache.provider === providerId &&
        modelCache.keyHash === currentKeyHash &&
        (now - modelCache.timestamp < CACHE_TTL)
    ) {
        console.log('[ModelService] Returning cached models.');
        return modelCache.data;
    }

    try {
        const provider = await providerRegistry.getProvider(providerId);
        const result = await provider.getModels(apiKey);

        // Update cache
        modelCache = {
            keyHash: currentKeyHash,
            provider: providerId,
            data: result,
            timestamp: now
        };

        return result;

    } catch (error: any) {
        console.error(`[ModelService] Failed to fetch models for provider ${providerId}:`, error);
        return {
            chatModels: [],
            imageModels: [],
            videoModels: [],
            ttsModels: []
        };
    }
}
