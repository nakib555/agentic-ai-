
/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { GoogleGenAI, FinishReason, Modality } from "@google/genai";
import type { AIProvider, ChatOptions, CompletionOptions, ModelLists } from './types';
import type { Model as AppModel } from '../../src/types';
import { generateContentWithRetry, generateContentStreamWithRetry, getText, generateImagesWithRetry, generateVideosWithRetry } from '../utils/geminiUtils';
import { transformHistoryToGeminiFormat } from '../utils/historyTransformer';

// Helper to sort models alpha-numerically
const sortModelsByName = (models: AppModel[]): AppModel[] => {
    return models.sort((a, b) => a.name.localeCompare(b.name));
};

// Helper to classify models based on ID and supported methods
const getModelCategory = (model: any): 'chat' | 'image' | 'video' | 'tts' | 'embedding' | null => {
    const id = model.name.replace('models/', '');
    const lowerId = id.toLowerCase();
    const methods = model.supportedGenerationMethods || [];

    if (methods.includes('generateVideos') || lowerId.includes('veo')) {
        return 'video';
    }

    // Exclude native audio models from TTS category as they are multimodal chat models
    if (lowerId.includes('tts') || (lowerId.includes('audio') && !lowerId.includes('flash-native-audio') && !lowerId.includes('pro-native-audio'))) {
        return 'tts';
    }

    if (methods.includes('generateImages') || lowerId.includes('imagen') || lowerId.includes('flash-image') || lowerId.includes('image-preview')) {
        // Some older Imagen models might be duplicates or deprecated, we generally keep them
        return 'image';
    }

    if (lowerId.includes('embedding') || lowerId.includes('aqa')) {
        return 'embedding';
    }

    if (methods.includes('generateContent')) {
        return 'chat';
    }

    return null;
};

const GeminiProvider: AIProvider = {
    id: 'gemini',
    name: 'Google Gemini',

    async getModels(apiKey: string): Promise<ModelLists> {
        try {
            console.log('[GeminiProvider] Fetching models...');
            const cleanKey = apiKey ? apiKey.trim() : '';
            
            if (!cleanKey) {
                console.warn('[GeminiProvider] No API key provided. Skipping model fetch.');
                return { chatModels: [], imageModels: [], videoModels: [], ttsModels: [] };
            }

            // Using header authentication only to avoid leaking key in URL logs
            const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models`, {
                headers: { 'x-goog-api-key': cleanKey }
            });
            
            if (!response.ok) {
                const errorBody = await response.text();
                
                // Handle 400 Bad Request (Invalid Key or Location issue) gracefully
                if (response.status === 400) {
                    console.warn('[GeminiProvider] Bad Request during model fetch:', errorBody);
                    // Return empty list instead of throwing to prevent app crash on invalid key
                    return { chatModels: [], imageModels: [], videoModels: [], ttsModels: [] };
                }

                throw new Error(`Failed to fetch models: ${response.status} ${response.statusText} - ${errorBody}`);
            }
    
            const data = await response.json();
            const modelList = data.models || [];
            
            const lists: ModelLists = {
                chatModels: [],
                imageModels: [],
                videoModels: [],
                ttsModels: []
            };
    
            for (const model of modelList) {
                const modelId = model.name.replace('models/', '');
                const modelInfo: AppModel = {
                    id: modelId,
                    name: model.displayName || modelId,
                    description: model.description || '',
                };

                const category = getModelCategory(model);
                
                switch (category) {
                    case 'chat': lists.chatModels.push(modelInfo); break;
                    case 'image': lists.imageModels.push(modelInfo); break;
                    case 'video': lists.videoModels.push(modelInfo); break;
                    case 'tts': lists.ttsModels.push(modelInfo); break;
                }
            }
    
            // Ensure fallback/default TTS model is present if not fetched
            const knownTtsModelId = 'gemini-2.5-flash-preview-tts';
            if (!lists.ttsModels.some(m => m.id === knownTtsModelId)) {
                 lists.ttsModels.push({
                    id: knownTtsModelId,
                    name: 'Gemini 2.5 Flash TTS',
                    description: 'Text-to-speech capabilities',
                });
            }
    
            return {
                chatModels: sortModelsByName(lists.chatModels),
                imageModels: sortModelsByName(lists.imageModels),
                videoModels: sortModelsByName(lists.videoModels),
                ttsModels: sortModelsByName(lists.ttsModels),
            };
        } catch (error: any) {
            console.error('[GeminiProvider] Model fetch failed:', error.message);
            // Return empty list on failure to prevent app crash
            return { chatModels: [], imageModels: [], videoModels: [], ttsModels: [] };
        }
    },

    async chat(options: ChatOptions): Promise<void> {
        const { 
            model, messages, systemInstruction, 
            temperature, maxTokens, apiKey, callbacks, 
            signal 
        } = options;
        
        if (!apiKey) throw new Error("Gemini API Key missing");
        if (!model) throw new Error("Model name is missing");

        const cleanKey = apiKey.trim();
        const ai = new GoogleGenAI({ apiKey: cleanKey });
        
        // Transform history once
        const fullHistory = transformHistoryToGeminiFormat(messages);

        // Sanitize Config
        const config: any = {};
        
        if (systemInstruction) config.systemInstruction = systemInstruction;
        if (typeof temperature === 'number') config.temperature = temperature;
        if (typeof maxTokens === 'number' && maxTokens > 0) config.maxOutputTokens = maxTokens;

        // --- STANDARD STREAMING CHAT ---
        try {
             // Try with standard tools (Grounding) enabled first
             const tools = [{ googleSearch: {} }];
             
             let result;
             
             try {
                 // Attempt 1: With Search Tool
                 result = await generateContentStreamWithRetry(ai, {
                    model,
                    contents: fullHistory,
                    config: {
                        ...config,
                        tools
                    }
                 });
             } catch (toolError: any) {
                 // If the model doesn't support tools/search (400 Invalid Argument), fallback to no tools
                 if (toolError.message?.includes('400') || toolError.message?.includes('INVALID_ARGUMENT') || toolError.message?.includes('tool')) {
                     console.warn(`[GeminiProvider] Model ${model} rejected tools. Retrying without tools.`);
                     result = await generateContentStreamWithRetry(ai, {
                        model,
                        contents: fullHistory,
                        config
                     });
                 } else {
                     throw toolError;
                 }
             }

             let fullText = '';
             let groundingMetadata: any = undefined;

             for await (const chunk of result) {
                if (signal?.aborted) return;
                
                const text = getText(chunk);
                if (text) {
                    fullText += text;
                    callbacks.onTextChunk(text);
                }
             }
             
             // Attempt to retrieve metadata from final response
             try {
                const response = await result.response;
                if (response?.candidates?.[0]) {
                     groundingMetadata = response.candidates[0].groundingMetadata;
                }
             } catch (e) {
                // Ignore if we have text but metadata fetch failed (common in stream interruptions)
                if (!fullText) throw e;
                console.warn('[GeminiProvider] Stream finished but final response object was missing.', e);
             }
             
             callbacks.onComplete({ finalText: fullText, groundingMetadata });

        } catch (error) {
            console.error("[GeminiProvider] Chat generation failed:", error);
            callbacks.onError(error);
        }
    },

    async complete(options: CompletionOptions): Promise<string> {
        const { model, prompt, systemInstruction, temperature, maxTokens, apiKey, jsonMode } = options;
        if (!apiKey) throw new Error("Gemini API Key missing");
        if (!model) throw new Error("Model name is missing");
        
        const ai = new GoogleGenAI({ apiKey: apiKey.trim() });
        
        const config: any = {};
        if (systemInstruction) config.systemInstruction = systemInstruction;
        if (typeof temperature === 'number') config.temperature = temperature;
        if (typeof maxTokens === 'number' && maxTokens > 0) config.maxOutputTokens = maxTokens;
        
        if (jsonMode) {
            config.responseMimeType = 'application/json';
        }

        try {
            const resp = await generateContentWithRetry(ai, {
                model,
                contents: prompt,
                config
            });
            return resp.text || '';
        } catch (error) {
            console.error('[GeminiProvider] Completion error:', error);
            throw error;
        }
    }
};

export default GeminiProvider;
