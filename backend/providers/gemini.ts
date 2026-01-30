
/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { GoogleGenAI, FinishReason, Modality } from "@google/genai";
import type { AIProvider, ChatOptions, CompletionOptions, ModelLists } from './types';
import type { Model as AppModel } from '../../src/types';
import { generateContentWithRetry, generateContentStreamWithRetry, getText, generateImagesWithRetry, generateVideosWithRetry } from '../utils/geminiUtils';
import { transformHistoryToGeminiFormat } from '../utils/historyTransformer';
import { toolDeclarations } from '../tools/declarations';
import { runAgenticLoop } from '../services/agenticLoop/index';

// Helper to sort models
const sortModelsByName = (models: AppModel[]): AppModel[] => {
    return models.sort((a, b) => a.name.localeCompare(b.name));
};

const GeminiProvider: AIProvider = {
    id: 'gemini',
    name: 'Google Gemini',

    async getModels(apiKey: string): Promise<ModelLists> {
        try {
            console.log('[GeminiProvider] Fetching models...');
            const cleanKey = apiKey ? apiKey.trim() : '';
            const response = await fetch('https://generativelanguage.googleapis.com/v1beta/models', {
                headers: { 'x-goog-api-key': cleanKey }
            });
            
            if (!response.ok) {
                const errorBody = await response.text();
                throw new Error(`Failed to fetch models: ${response.status} ${response.statusText} - ${errorBody}`);
            }
    
            const data = await response.json();
            const modelList = data.models || [];
            
            const chatModels: AppModel[] = [];
            const imageModels: AppModel[] = [];
            const videoModels: AppModel[] = [];
            const ttsModels: AppModel[] = [];
    
            for (const model of modelList) {
                const modelId = model.name.replace('models/', '');
                const modelInfo: AppModel = {
                    id: modelId,
                    name: model.displayName || modelId,
                    description: model.description || '',
                };
    
                const methods = model.supportedGenerationMethods || [];
                const lowerId = modelId.toLowerCase();
    
                if (methods.includes('generateVideos') || lowerId.includes('veo')) {
                    videoModels.push(modelInfo);
                    continue; 
                }
    
                if (lowerId.includes('tts') || (lowerId.includes('audio') && !lowerId.includes('flash-native-audio') && !lowerId.includes('pro-native-audio'))) {
                    ttsModels.push(modelInfo);
                    continue; 
                }
    
                if (methods.includes('generateImages') || lowerId.includes('imagen') || lowerId.includes('flash-image') || lowerId.includes('image-preview')) {
                    imageModels.push(modelInfo);
                    if (lowerId.includes('imagen') || lowerId.includes('flash-image') || lowerId.includes('image-preview')) {
                        continue;
                    }
                }
    
                if (methods.includes('generateContent') && !lowerId.includes('embedding') && !lowerId.includes('aqa')) {
                    chatModels.push(modelInfo);
                }
            }
    
            // Ensure TTS model is present if not fetched
            const knownTtsModelId = 'gemini-2.5-flash-preview-tts';
            if (!ttsModels.some(m => m.id === knownTtsModelId)) {
                 ttsModels.push({
                    id: knownTtsModelId,
                    name: 'Gemini 2.5 Flash TTS',
                    description: 'Text-to-speech capabilities',
                });
            }
    
            return {
                chatModels: sortModelsByName(chatModels),
                imageModels: sortModelsByName(imageModels),
                videoModels: sortModelsByName(videoModels),
                ttsModels: sortModelsByName(ttsModels),
            };
        } catch (error: any) {
            console.error('[GeminiProvider] Model fetch failed:', error);
            throw error;
        }
    },

    async chat(options: ChatOptions): Promise<void> {
        const { model, messages, newMessage, systemInstruction, temperature, maxTokens, apiKey, callbacks, isAgentMode, toolExecutor, signal, chatId } = options;
        
        if (!apiKey) throw new Error("Gemini API Key missing");
        
        const cleanKey = apiKey.trim();
        const ai = new GoogleGenAI({ apiKey: cleanKey });
        
        // Construct History
        // We include the new message in the history transformation for Gemini if it's not already there
        // (The hook usually adds it to 'messages' before calling this, but we handle the raw list)
        let historyForAI = [...messages];
        if (newMessage && !messages.find(m => m.id === newMessage.id)) {
            // If newMessage isn't in history yet (rare with current hook logic but safe to check)
            // historyForAI.push(newMessage); 
        }
        
        // Transform to Gemini Content[] format
        const fullHistory = transformHistoryToGeminiFormat(historyForAI);

        // --- AGENT MODE ---
        if (isAgentMode && toolExecutor && chatId) {
            if (!toolExecutor) throw new Error("Tool executor required for Agent Mode");
             // Agent Loop logic handled in separate service
             await runAgenticLoop({
                 ai,
                 model,
                 history: fullHistory,
                 toolExecutor,
                 callbacks: {
                     ...callbacks,
                     // Provide default no-op functions for optional callbacks
                     onNewToolCalls: callbacks.onNewToolCalls || (() => {}),
                     onToolResult: callbacks.onToolResult || (() => {}),
                     onPlanReady: callbacks.onPlanReady || (async () => false),
                     onFrontendToolRequest: callbacks.onFrontendToolRequest || (() => {}),
                     onCancel: callbacks.onCancel || (() => {}),
                     // Adapter for onComplete signature mismatch
                     onComplete: (finalText, groundingMetadata) => {
                        callbacks.onComplete({ finalText, groundingMetadata });
                     }
                 },
                 settings: {
                     temperature,
                     maxOutputTokens: maxTokens,
                     systemInstruction
                 },
                 signal: signal!,
                 threadId: chatId
             });
             return;
        }

        // --- STANDARD STREAMING CHAT ---
        // For Chat Mode (non-agentic) or if no tool executor provided
        try {
             // Add search tool for grounding in standard chat if desired
             const tools = [{ googleSearch: {} }];
             
             const result = await generateContentStreamWithRetry(ai, {
                model,
                contents: fullHistory,
                config: {
                    systemInstruction,
                    temperature,
                    maxOutputTokens: maxTokens,
                    tools: tools
                }
             });

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
             
             // CRITICAL FIX: Safe access to response properties.
             // The stream might have finished without a final response object if it was interrupted or blocked.
             try {
                const response = await result.response;
                if (response && response.candidates && response.candidates.length > 0) {
                     groundingMetadata = response.candidates[0].groundingMetadata;
                }
             } catch (e) {
                // If fetching the final response fails but we have text, we can proceed.
                // If we have NO text and it failed, then it's a real error.
                if (!fullText) {
                    throw e;
                }
                console.warn('[GeminiProvider] Stream finished but final response object was missing.', e);
             }
             
             callbacks.onComplete({ finalText: fullText, groundingMetadata });

        } catch (error) {
            callbacks.onError(error);
        }
    },

    async complete(options: CompletionOptions): Promise<string> {
        const { model, prompt, systemInstruction, temperature, maxTokens, apiKey, jsonMode } = options;
        if (!apiKey) throw new Error("Gemini API Key missing");
        
        const cleanKey = apiKey.trim();
        const ai = new GoogleGenAI({ apiKey: cleanKey });
        
        const config: any = { 
            systemInstruction,
            temperature,
            maxOutputTokens: maxTokens 
        };
        
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
