/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { ensureSettingsLoaded, saveSettings, getApiKey, getGeminiKey, getProvider } from './services/settingsService';
import { listAvailableModels } from './services/modelService';

export { getApiKey, getGeminiKey, getProvider };

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
        
        // Persist to DB
        await saveSettings(newSettings);

        // Check if any configuration that affects models has been touched in this request.
        const shouldRefreshModels = 
            (updates.provider && updates.provider !== currentSettings.provider) ||
            'apiKey' in updates ||
            'openRouterApiKey' in updates ||
            'ollamaApiKey' in updates ||
            'ollamaHost' in updates;

        if (shouldRefreshModels) {
            try {
                const activeProvider = newSettings.provider;
                let activeKey = '';

                if (activeProvider === 'openrouter') {
                    activeKey = newSettings.openRouterApiKey || process.env.OPENROUTER_API_KEY;
                } else if (activeProvider === 'ollama') {
                    activeKey = newSettings.ollamaApiKey || process.env.OLLAMA_API_KEY;
                } else {
                    activeKey = newSettings.apiKey;
                }
                
                if (activeKey || activeProvider === 'ollama') {
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
