

/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import type { AIProvider, ChatOptions, CompletionOptions, ModelLists } from './types';
import type { Model as AppModel } from '../../src/types';

// Helper to sort models
const sortModelsByName = (models: AppModel[]): AppModel[] => {
    return models.sort((a, b) => a.name.localeCompare(b.name));
};

const OpenRouterProvider: AIProvider = {
    id: 'openrouter',
    name: 'OpenRouter',

    async getModels(apiKey: string): Promise<ModelLists> {
        try {
            console.log('[OpenRouterProvider] Fetching models...');
            const cleanKey = apiKey ? apiKey.trim() : '';
            const headers: Record<string, string> = { 'Content-Type': 'application/json' };
            if (cleanKey) headers['Authorization'] = `Bearer ${cleanKey}`;
    
            const response = await fetch('https://openrouter.ai/api/v1/models', { method: 'GET', headers });
    
            if (!response.ok) {
                const errorText = await response.text();
                throw new Error(`OpenRouter API error: ${response.status} ${response.statusText} - ${errorText}`);
            }
    
            const data = await response.json();
            
            const chatModels: AppModel[] = [];
            const imageModels: AppModel[] = [];
            const videoModels: AppModel[] = [];
            const ttsModels: AppModel[] = [];
    
            for (const m of (data.data || [])) {
                const id = m.id.toLowerCase();
                const modelInfo = { id: m.id, name: m.name || m.id, description: m.description || '' };
    
                if (id.includes('embedding')) continue;
    
                if (id.includes('video') || id.includes('sora') || id.includes('runway') || id.includes('luma')) {
                    videoModels.push(modelInfo);
                    continue;
                }
    
                if (id.includes('image') || id.includes('stable-diffusion') || id.includes('dall-e') || id.includes('midjourney') || id.includes('flux')) {
                    imageModels.push(modelInfo);
                    continue;
                }
    
                if (id.includes('tts') || id.includes('audio') && !id.includes('gpt-4o')) {
                    ttsModels.push(modelInfo);
                    continue;
                }
    
                chatModels.push(modelInfo);
            }
    
            return {
                chatModels: sortModelsByName(chatModels),
                imageModels: sortModelsByName(imageModels),
                videoModels: sortModelsByName(videoModels),
                ttsModels: sortModelsByName(ttsModels)
            };
        } catch (error: any) {
            console.error('[OpenRouterProvider] Failed to fetch models:', error);
            // Don't crash the whole app if models fail to load, just return empty
            return { chatModels: [], imageModels: [], videoModels: [], ttsModels: [] };
        }
    },

    async chat(options: ChatOptions): Promise<void> {
        const { model, messages, systemInstruction, temperature, maxTokens, apiKey, callbacks, signal } = options;

        if (!apiKey) throw new Error("OpenRouter API Key missing");
        
        const cleanKey = apiKey.trim();

        // Convert messages to OpenRouter format
        const openRouterMessages = messages
            .filter(m => !m.isHidden)
            .map(msg => {
                // If msg is user, text is simple. If model, check active response.
                let content = '';
                if (msg.role === 'user') {
                     content = msg.versions?.[msg.activeVersionIndex ?? 0]?.text || msg.text || '';
                } else {
                     content = msg.responses?.[msg.activeResponseIndex]?.text || msg.text || '';
                }
                return {
                    role: msg.role === 'model' ? 'assistant' : 'user',
                    content
                };
            });

        if (systemInstruction) {
            openRouterMessages.unshift({ role: 'system', content: systemInstruction });
        }

        try {
            const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
                method: "POST",
                headers: {
                    "Authorization": `Bearer ${cleanKey}`,
                    "Content-Type": "application/json",
                    "HTTP-Referer": "https://agentic-ai-chat.local",
                    "X-Title": "Agentic AI Chat",
                },
                body: JSON.stringify({
                    model: model,
                    messages: openRouterMessages,
                    stream: true,
                    temperature: temperature,
                    max_tokens: maxTokens && maxTokens > 0 ? maxTokens : undefined,
                }),
                signal
            });

            if (!response.ok) {
                const errorText = await response.text();
                throw new Error(`OpenRouter Error: ${errorText}`);
            }

            if (!response.body) throw new Error("No response body");

            const reader = response.body.getReader();
            const decoder = new TextDecoder("utf-8");
            let fullText = "";
            let buffer = "";

            while (true) {
                if (signal?.aborted) break;
                const { done, value } = await reader.read();
                
                if (value) {
                    buffer += decoder.decode(value, { stream: true });
                }

                // Process complete lines only
                const lines = buffer.split("\n");
                
                // If we are done, process everything. 
                // If not done, keep the last segment in buffer as it might be incomplete.
                const linesToProcess = done ? lines : lines.slice(0, -1);
                buffer = done ? "" : lines[lines.length - 1];

                for (const line of linesToProcess) {
                    const trimmedLine = line.trim();
                    if (!trimmedLine) continue;
                    
                    if (trimmedLine.startsWith("data: ")) {
                        const dataStr = trimmedLine.replace("data: ", "");
                        if (dataStr === "[DONE]") break;

                        try {
                            const data = JSON.parse(dataStr);
                            const delta = data.choices[0]?.delta?.content;
                            if (delta) {
                                fullText += delta;
                                callbacks.onTextChunk(delta);
                            }
                        } catch (e) {
                             // Ignore parse errors for partial chunks (though buffering should prevent this)
                             console.warn("OpenRouter stream parse warning:", e);
                        }
                    }
                }
                
                if (done) break;
            }

            callbacks.onComplete({ finalText: fullText });

        } catch (error: any) {
            // Enhanced error handling for connectivity issues
            if (error.message && error.message.includes('fetch failed')) {
                callbacks.onError(new Error("Failed to connect to OpenRouter. Please check your internet connection."));
            } else {
                callbacks.onError(error);
            }
        }
    },

    async complete(options: CompletionOptions): Promise<string> {
        const { model, prompt, systemInstruction, apiKey, jsonMode } = options;
        if (!apiKey) throw new Error("OpenRouter API Key missing");
        
        const cleanKey = apiKey.trim();

        try {
             const messages = [];
             if (systemInstruction) messages.push({ role: 'system', content: systemInstruction });
             messages.push({ role: 'user', content: prompt });
             
             const resp = await fetch("https://openrouter.ai/api/v1/chat/completions", {
                method: "POST",
                headers: {
                    "Authorization": `Bearer ${cleanKey}`,
                    "Content-Type": "application/json",
                    "HTTP-Referer": "https://agentic-ai-chat.local",
                    "X-Title": "Agentic AI Chat",
                },
                body: JSON.stringify({
                    model: model,
                    messages: messages,
                    stream: false,
                    response_format: jsonMode ? { type: "json_object" } : undefined
                })
            });
            
            if (!resp.ok) return '';
            const data = await resp.json();
            return data.choices?.[0]?.message?.content || '';
        } catch (error) {
            console.error("OpenRouter completion error:", error);
            return '';
        }
    }
};

export default OpenRouterProvider;
