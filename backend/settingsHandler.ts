
/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { SETTINGS_FILE_PATH, readData, writeData } from './data-store';
import { listAvailableModels } from './services/modelService';

// In-memory cache for settings to avoid reading disk on every request
let cachedSettings: any = null;

const ensureSettingsLoaded = async () => {
    if (!cachedSettings) {
        try {
            cachedSettings = await readData(SETTINGS_FILE_PATH);
        } catch (error) {
            console.error('Failed to load settings into cache:', error);
            // Fallback or re-throw depending on severity, but here we likely want to know it failed.
            throw error;
        }
    }
    return cachedSettings;
};

export const getSettings = async (req: any, res: any) => {
    try {
        const settings = await ensureSettingsLoaded();
        res.status(200).json(settings);
    } catch (error) {
        console.error('Failed to get settings:', error);
        res.status(500).json({ error: 'Failed to retrieve settings.' });
    }
};

export const updateSettings = async (req: any, res: any) => {
    try {
        const currentSettings = await ensureSettingsLoaded();
        const updates = req.body;
        
        const newSettings = { ...currentSettings, ...updates };
        
        // Update Cache Immediately
        cachedSettings = newSettings;
        
        // Persist to Disk
        await writeData(SETTINGS_FILE_PATH, newSettings);

        // Check if any configuration that affects models has been touched in this request.
        // We check for the presence of keys in 'updates' to ensure that even if the value 
        // hasn't changed (e.g. user clicking Save again), we still force a refresh as requested.
        const shouldRefreshModels = 
            (updates.provider && updates.provider !== currentSettings.provider) ||
            'apiKey' in updates ||
            'openRouterApiKey' in updates ||
            'ollamaApiKey' in updates ||
            'ollamaHost' in updates;

        if (shouldRefreshModels) {
            try {
                // Determine the active key based on the provider we are switching to (or are currently on)
                const activeProvider = newSettings.provider;
                let activeKey = '';

                if (activeProvider === 'openrouter') {
                    activeKey = newSettings.openRouterApiKey || process.env.OPENROUTER_API_KEY;
                } else if (activeProvider === 'ollama') {
                    activeKey = newSettings.ollamaApiKey || process.env.OLLAMA_API_KEY;
                } else {
                    activeKey = newSettings.apiKey;
                }
                
                // Strictly require a key to fetch models, unless provider is Ollama which supports keyless local operation
                if (activeKey || activeProvider === 'ollama') {
                    // Force refresh (second param = true) to bypass cache and get latest models
                    const { chatModels, imageModels, videoModels, ttsModels } = await listAvailableModels(
                        activeKey || '', 
                        true,
                        activeProvider
                    );
                    
                    res.status(200).json({ 
                        ...newSettings, 
                        models: chatModels, 
                        imageModels, 
                        videoModels, 
                        ttsModels 
                    });
                    return;
                }
            } catch (error) {
                // If fetching models fails (invalid key/host), we explicitly return empty arrays.
                // This ensures the frontend clears its list immediately and doesn't fall back to a stale 'fetchModels' call.
                console.error("Auto-fetch models failed:", error);
                
                res.status(200).json({ 
                    ...newSettings, 
                    models: [], 
                    imageModels: [], 
                    videoModels: [], 
                    ttsModels: [] 
                });
                return;
            }
        }

        res.status(200).json(newSettings);
    } catch (error) {
        console.error('Failed to update settings:', error);
        res.status(500).json({ error: 'Failed to update settings.' });
    }
};

export const getApiKey = async (): Promise<string | undefined> => {
    try {
        const settings = await ensureSettingsLoaded();
        if (settings.provider === 'openrouter') {
            return settings.openRouterApiKey || process.env.OPENROUTER_API_KEY;
        }
        if (settings.provider === 'ollama') {
            return settings.ollamaApiKey || process.env.OLLAMA_API_KEY;
        }
        // For Gemini
        return settings.apiKey || process.env.API_KEY || process.env.GEMINI_API_KEY;
    } catch (error) {
        return process.env.API_KEY || process.env.GEMINI_API_KEY;
    }
};

export const getGeminiKey = async (): Promise<string | undefined> => {
    try {
        const settings = await ensureSettingsLoaded();
        // Always try to return the Gemini key, regardless of active provider
        return settings.apiKey || process.env.API_KEY || process.env.GEMINI_API_KEY;
    } catch (error) {
        return process.env.API_KEY || process.env.GEMINI_API_KEY;
    }
};

export const getProvider = async (): Promise<'gemini' | 'openrouter' | 'ollama'> => {
    try {
        const settings = await ensureSettingsLoaded();
        return settings.provider || 'gemini';
    } catch (error) {
        return 'gemini';
    }
};
