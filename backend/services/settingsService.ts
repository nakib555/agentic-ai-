/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import db from '../db';

const SETTINGS_KEY = 'global';

// Default settings
const defaultSettings = {
    provider: 'gemini',
    apiKey: '',
    openRouterApiKey: '',
    ollamaHost: '',
    aboutUser: '',
    aboutResponse: '',
    temperature: 0.7,
    maxTokens: 0,
    imageModel: '',
    videoModel: '',
    isMemoryEnabled: false,
    ttsVoice: 'Kore',
    ttsModel: '',
    isAgentMode: false,
    activeModel: '', 
};

// In-memory cache
let cachedSettings: any = null;

export const ensureSettingsLoaded = async () => {
    if (!cachedSettings) {
        try {
            const row = db.prepare('SELECT value FROM settings WHERE key = ?').get(SETTINGS_KEY) as any;

            if (row) {
                cachedSettings = JSON.parse(row.value);
            } else {
                // Initialize defaults if not found
                cachedSettings = defaultSettings;
                db.prepare('INSERT INTO settings (key, value, updatedAt) VALUES (?, ?, ?)').run(
                    SETTINGS_KEY,
                    JSON.stringify(defaultSettings),
                    Date.now()
                );
            }
        } catch (error) {
            console.error('Failed to load settings from DB:', error);
            // Fallback to defaults in memory if DB fails
            cachedSettings = defaultSettings;
        }
    }
    return cachedSettings;
};

export const saveSettings = async (newSettings: any) => {
    cachedSettings = newSettings;
    
    const stmt = db.prepare(`
        INSERT INTO settings (key, value, updatedAt)
        VALUES (?, ?, ?)
        ON CONFLICT(key) DO UPDATE SET
            value = excluded.value,
            updatedAt = excluded.updatedAt
    `);
    
    stmt.run(SETTINGS_KEY, JSON.stringify(newSettings), Date.now());
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
