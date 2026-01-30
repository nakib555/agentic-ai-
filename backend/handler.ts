
/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { Request as ExpressRequest, Response as ExpressResponse } from 'express';
import { promises as fs } from 'fs';
import path from 'path';
import { CHAT_PERSONA_AND_UI_FORMATTING as chatModeSystemInstruction } from './prompts/chatPersona';
import { parseApiError } from './utils/apiError';
import { executeTextToSpeech } from "./tools/tts";
import { executeExtractMemorySuggestions, executeConsolidateMemory } from "./tools/memory";
import { executeWithPiston } from "./tools/piston";
import { getApiKey, getProvider, getGeminiKey } from './settingsHandler';
import { generateProviderCompletion } from './utils/generateProviderCompletion';
import { historyControl } from './services/historyControl';
import { vectorMemory } from './services/vectorMemory';
import { readData, SETTINGS_FILE_PATH } from './data-store';
import { providerRegistry } from './providers/registry'; 
import { GoogleGenAI } from "@google/genai";

// --- JOB MANAGEMENT SYSTEM ---

interface Job {
    chatId: string;
    messageId: string;
    controller: AbortController;
    clients: Set<any>; 
    eventBuffer: string[]; 
    persistence: ChatPersistenceManager;
    createdAt: number;
}

const activeJobs = new Map<string, Job>();

const writeToClient = (job: Job, type: string, payload: any) => {
    const data = JSON.stringify({ type, payload }) + '\n';
    job.eventBuffer.push(data);
    job.clients.forEach(client => {
        if (!client.writableEnded && !client.closed && !client.destroyed) {
            try {
                client.write(data);
            } catch (e) {
                console.error(`[JOB] Failed to write to client for chat ${job.chatId}`, e);
                job.clients.delete(client);
            }
        } else {
             job.clients.delete(client);
        }
    });
};

const cleanupJob = (chatId: string) => {
    const job = activeJobs.get(chatId);
    if (job) {
        job.clients.forEach(c => {
            if (!c.writableEnded) c.end();
        });
        activeJobs.delete(chatId);
    }
};

const generateId = () => `req_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;

async function generateAsciiTree(dirPath: string, prefix: string = ''): Promise<string> {
    let output = '';
    let entries;
    try {
        entries = await fs.readdir(dirPath, { withFileTypes: true });
    } catch (e) {
        return `${prefix} [Error reading directory]\n`;
    }
    entries = entries.filter(e => !e.name.startsWith('.'));
    entries.sort((a, b) => {
        if (a.isDirectory() === b.isDirectory()) {
            return a.name.localeCompare(b.name);
        }
        return a.isDirectory() ? -1 : 1;
    });
    for (let i = 0; i < entries.length; i++) {
        const entry = entries[i];
        const isLast = i === entries.length - 1;
        const connector = isLast ? '└── ' : '├── ';
        output += `${prefix}${connector}${entry.name}\n`;
        if (entry.isDirectory()) {
            const childPrefix = prefix + (isLast ? '    ' : '│   ');
            output += await generateAsciiTree(path.join(dirPath, entry.name), childPrefix);
        }
    }
    return output;
}

async function generateDirectoryStructure(dirPath: string): Promise<any> {
    const name = path.basename(dirPath);
    let stats;
    try { stats = await fs.stat(dirPath); } catch { return null; }
    if (stats.isDirectory()) {
        let entries;
        try { entries = await fs.readdir(dirPath, { withFileTypes: true }); } catch { return null; }
        const children = [];
        entries.sort((a, b) => {
            if (a.isDirectory() === b.isDirectory()) { return a.name.localeCompare(b.name); }
            return a.isDirectory() ? -1 : 1;
        });
        for (const entry of entries) {
            if (entry.name.startsWith('.')) continue;
            const childPath = path.join(dirPath, entry.name);
            const childNode = await generateDirectoryStructure(childPath);
            if (childNode) children.push(childNode);
        }
        return { name, type: 'directory', children };
    } else {
        return { name, type: 'file' };
    }
}

class ChatPersistenceManager {
    private chatId: string;
    private messageId: string;
    private buffer: { text: string } | null = null;
    private saveTimeout: ReturnType<typeof setTimeout> | null = null;
    // Reduced from 1500ms to 200ms to minimize data loss on crash
    private readonly FLUSH_DELAY_MS = 200; 

    constructor(chatId: string, messageId: string) {
        this.chatId = chatId;
        this.messageId = messageId;
    }
    addText(delta: string) {
        if (!this.buffer) this.buffer = { text: '' };
        this.buffer.text += delta;
        this.scheduleSave();
    }
    async update(modifier: (response: any) => void) {
        if (this.saveTimeout) {
            clearTimeout(this.saveTimeout);
            this.saveTimeout = null;
        }
        try {
            const chat = await historyControl.getChat(this.chatId);
            if (!chat) return;
            const msgIndex = chat.messages.findIndex((m: any) => m.id === this.messageId);
            if (msgIndex !== -1) {
                const message = chat.messages[msgIndex];
                if (message.responses && message.responses[message.activeResponseIndex]) {
                    const activeResponse = message.responses[message.activeResponseIndex];
                    if (this.buffer) {
                        activeResponse.text = (activeResponse.text || '') + this.buffer.text;
                        this.buffer = null;
                    }
                    modifier(activeResponse);
                    await historyControl.updateChat(this.chatId, { messages: chat.messages });
                }
            }
        } catch (e) {
            console.error(`[PERSISTENCE] Failed to update chat ${this.chatId}:`, e);
        }
    }
    private scheduleSave() {
        if (this.saveTimeout) return;
        this.saveTimeout = setTimeout(() => this.flush(), this.FLUSH_DELAY_MS); 
    }
    private async flush() {
        this.saveTimeout = null;
        if (!this.buffer) return;
        const textToAppend = this.buffer.text;
        this.buffer = null; 
        try {
            const chat = await historyControl.getChat(this.chatId);
            if (!chat) return;
            const msgIndex = chat.messages.findIndex((m: any) => m.id === this.messageId);
            if (msgIndex !== -1) {
                const message = chat.messages[msgIndex];
                if (message.responses && message.responses[message.activeResponseIndex]) {
                    const activeResponse = message.responses[message.activeResponseIndex];
                    activeResponse.text = (activeResponse.text || '') + textToAppend;
                    await historyControl.updateChat(this.chatId, { messages: chat.messages });
                }
            }
        } catch (e) { }
    }
    async complete(finalModifier?: (response: any) => void) {
        if (this.saveTimeout) clearTimeout(this.saveTimeout);
        try {
            const chat = await historyControl.getChat(this.chatId);
            if (!chat) return;
            const msgIndex = chat.messages.findIndex((m: any) => m.id === this.messageId);
            if (msgIndex !== -1) {
                const message = chat.messages[msgIndex];
                if (message.responses && message.responses[message.activeResponseIndex]) {
                    const activeResponse = message.responses[message.activeResponseIndex];
                    if (this.buffer) {
                        activeResponse.text = (activeResponse.text || '') + this.buffer.text;
                        this.buffer = null;
                    }
                    if (finalModifier) finalModifier(activeResponse);
                    message.isThinking = false;
                    await historyControl.updateChat(this.chatId, { messages: chat.messages });
                }
            }
        } catch (e) {
            console.error(`[PERSISTENCE] Failed to complete save for chat ${this.chatId}:`, e);
        }
    }
}

export const apiHandler = async (req: any, res: any) => {
    const task = req.query.task as string;
    
    // --- RECONNECTION HANDLING ---
    if (task === 'connect') {
        const { chatId } = req.body; 
        const job = activeJobs.get(chatId);
        
        if (!job) {
            return res.status(200).json({ status: "stream_not_found" });
        }
        
        res.setHeader('Content-Type', 'application/json');
        res.setHeader('Transfer-Encoding', 'chunked');
        res.flushHeaders();
        
        job.clients.add(res);
        console.log(`[HANDLER] Client reconnected to job ${chatId}`);
        
        for (const event of job.eventBuffer) {
            res.write(event);
        }
        
        req.on('close', () => {
            job.clients.delete(res);
        });
        
        return;
    }

    // --- CONTEXT SETUP ---
    const activeProviderName = await getProvider();
    
    // chatApiKey is the key for the selected provider (e.g. OpenRouter key)
    const chatApiKey = await getApiKey(); 
    
    // geminiKey is specifically for auxiliary services (TTS, Embeddings, Memory)
    // We try to get it even if the main provider is OpenRouter/Ollama
    const geminiKey = await getGeminiKey();
    
    const globalSettings: any = await readData(SETTINGS_FILE_PATH);
    const activeModel = globalSettings.activeModel || 'gemini-2.5-flash';

    const isSuggestionTask = ['title', 'suggestions', 'enhance', 'memory_suggest', 'memory_consolidate', 'run_piston'].includes(task);
    const BYPASS_TASKS = ['cancel', 'debug_data_tree', 'feedback', 'count_tokens'];
    
    // Validation: Require key for paid providers, skip for Ollama/bypass
    if (!chatApiKey && !BYPASS_TASKS.includes(task) && !isSuggestionTask && activeProviderName !== 'ollama') {
        return res.status(401).json({ error: "API key not configured for the selected provider." });
    }
    
    // Initialize Auxiliary AI (Gemini) for TTS/Memory if available
    const auxAi = (geminiKey) ? new GoogleGenAI({ apiKey: geminiKey }) : null;

    if (auxAi) {
        await vectorMemory.init(auxAi);
    }

    try {
        switch (task) {
            case 'chat': 
            case 'regenerate': {
                const { chatId, model, settings, newMessage, messageId } = req.body;
                
                let savedChat = await historyControl.getChat(chatId);
                if (!savedChat) return res.status(404).json({ error: "Chat not found" });

                let historyMessages = savedChat.messages || [];
                let historyForAI: any[] = [];

                if (task === 'chat' && newMessage) {
                    historyMessages.push(newMessage);
                    // Only add vector memory if we have a Gemini Client (auxAi)
                    if (auxAi && newMessage.text && newMessage.text.length > 10) {
                        vectorMemory.addMemory(newMessage.text, { chatId, role: 'user' }).catch(console.error);
                    }
                    const modelPlaceholder = {
                        id: messageId,
                        role: 'model' as const,
                        text: '',
                        isThinking: true,
                        startTime: Date.now(),
                        responses: [{ text: '', toolCallEvents: [], startTime: Date.now() }],
                        activeResponseIndex: 0
                    };
                    historyMessages.push(modelPlaceholder);
                    savedChat = await historyControl.updateChat(chatId, { messages: historyMessages });
                    historyForAI = historyMessages.slice(0, -1);
                } else if (task === 'regenerate') {
                     const targetIndex = historyMessages.findIndex((m: any) => m.id === messageId);
                     if (targetIndex !== -1) {
                         historyForAI = historyMessages.slice(0, targetIndex);
                     } else {
                         // Fallback creation
                         const modelPlaceholder = {
                            id: messageId,
                            role: 'model' as const,
                            text: '',
                            isThinking: true,
                            startTime: Date.now(),
                            responses: [{ text: '', toolCallEvents: [], startTime: Date.now() }],
                            activeResponseIndex: 0
                        };
                        historyMessages.push(modelPlaceholder);
                        savedChat = await historyControl.updateChat(chatId, { messages: historyMessages });
                        historyForAI = historyMessages.slice(0, -1);
                     }
                }

                if (activeJobs.has(chatId)) {
                    console.log(`[HANDLER] Cancelling existing job for ${chatId}`);
                    const oldJob = activeJobs.get(chatId);
                    oldJob?.controller.abort();
                    activeJobs.delete(chatId);
                }

                const persistence = new ChatPersistenceManager(chatId, messageId);
                const abortController = new AbortController();
                const job: Job = {
                    chatId,
                    messageId,
                    controller: abortController,
                    clients: new Set([res]), 
                    eventBuffer: [],
                    persistence,
                    createdAt: Date.now()
                };
                activeJobs.set(chatId, job);

                res.setHeader('Content-Type', 'application/json');
                res.setHeader('Transfer-Encoding', 'chunked');
                res.flushHeaders();

                writeToClient(job, 'start', { requestId: chatId });
                const pingInterval = setInterval(() => writeToClient(job, 'ping', {}), 10000);
                
                req.on('close', () => { job.clients.delete(res); });

                let ragContext = "";
                // RAG only available if auxAi (Gemini) is initialized
                if (auxAi && newMessage && newMessage.text) {
                    try {
                        const relevantMemories = await vectorMemory.retrieveRelevant(newMessage.text);
                        if (relevantMemories.length > 0) {
                            ragContext = `\n## 🧠 RELEVANT MEMORIES (RAG)\nThe following past information may be relevant:\n- ${relevantMemories.join('\n- ')}\n\n`;
                        }
                    } catch (e) {
                        console.error("[RAG] Retrieval failed:", e);
                    }
                }

                const coreInstruction = chatModeSystemInstruction;
                const { systemPrompt, aboutUser, aboutResponse, memoryContent } = settings;
                
                let personalizationSection = "";
                if (aboutUser?.trim()) personalizationSection += `\n## 👤 USER PROFILE & CONTEXT\n${aboutUser.trim()}\n`;
                if (aboutResponse?.trim()) personalizationSection += `\n## 🎭 RESPONSE STYLE\n${aboutResponse.trim()}\n`;
                if (memoryContent?.trim()) personalizationSection += `\n## 🧠 CORE MEMORY\n${memoryContent.trim()}\n`;
                if (systemPrompt?.trim()) personalizationSection += `\n## 🔧 CUSTOM DIRECTIVES\n${systemPrompt.trim()}\n`;
                if (ragContext) personalizationSection += ragContext;

                let finalSystemInstruction = coreInstruction;
                if (personalizationSection) {
                    finalSystemInstruction = `
# ⚙️ SYSTEM KERNEL (IMMUTABLE PROTOCOLS)
${coreInstruction}

================================================================================

# 🧩 CONTEXTUAL LAYER (PERSONALIZATION)
${personalizationSection}
`.trim();
                }

                // --- PROVIDER DISPATCH ---
                try {
                    const provider = await providerRegistry.getProvider(activeProviderName);

                    await provider.chat({
                        model,
                        messages: historyForAI,
                        newMessage,
                        systemInstruction: finalSystemInstruction,
                        temperature: settings.temperature,
                        maxTokens: settings.maxOutputTokens,
                        apiKey: chatApiKey, // Use the provider-specific key
                        isAgentMode: false,
                        signal: abortController.signal,
                        chatId,
                        callbacks: {
                            onTextChunk: (text) => {
                                writeToClient(job, 'text-chunk', text);
                                persistence.addText(text);
                            },
                            onNewToolCalls: (events) => {
                                // No-op in pure chat mode, but kept interface compatible
                            },
                            onToolResult: (id, result) => {
                                // No-op
                            },
                            onPlanReady: (plan) => {
                                return Promise.resolve(false);
                            },
                            onFrontendToolRequest: (callId, name, args) => {},
                            onComplete: (data) => {
                                writeToClient(job, 'complete', data);
                                persistence.complete((r) => {
                                    r.endTime = Date.now();
                                    if (data.groundingMetadata) r.groundingMetadata = data.groundingMetadata;
                                });
                                // Only vectorize if Gemini is available
                                if (data.finalText.length > 50 && auxAi) {
                                    vectorMemory.addMemory(data.finalText, { chatId, role: 'model' }).catch(console.error);
                                }
                            },
                            onError: (err) => {
                                const parsed = parseApiError(err);
                                writeToClient(job, 'error', parsed);
                                persistence.complete((r) => { r.error = parsed; r.endTime = Date.now(); });
                            },
                            onCancel: () => {
                                writeToClient(job, 'cancel', {});
                                persistence.complete();
                            }
                        }
                    });

                } catch (e: any) {
                    console.error(`[HANDLER] Chat logic failed:`, e);
                    const parsedError = parseApiError(e);
                    // Explicitly write to the stream even if headers are sent
                    writeToClient(job, 'error', parsedError);
                    persistence.complete((response) => { response.error = parsedError; });
                } finally {
                    clearInterval(pingInterval);
                    cleanupJob(chatId);
                }
                break;
            }
            case 'cancel': {
                const { requestId } = req.body;
                let job = activeJobs.get(requestId);
                if (job) {
                    job.controller.abort();
                    res.status(200).send({ message: 'Cancellation request received.' });
                } else {
                    res.status(404).json({ error: `No active job found for ID: ${requestId}` });
                }
                break;
            }
            case 'feedback': {
                const { chatId, messageId, feedback } = req.body;
                console.log(`[FEEDBACK] Chat: ${chatId}, Msg: ${messageId}, Rating: ${feedback}`);
                res.status(200).json({ status: 'ok' });
                break;
            }
            case 'title': {
                const { messages, model } = req.body;
                const historyText = messages.slice(0, 3).map((m: any) => `${m.role}: ${m.text}`).join('\n');
                const prompt = `Generate a short concise title (max 6 words) for this conversation.\n\nCONVERSATION:\n${historyText}\n\nTITLE:`;
                const title = await generateProviderCompletion(activeProviderName, chatApiKey, model, prompt);
                res.status(200).json({ title: title.trim() });
                break;
            }
            case 'suggestions': {
                const { conversation, model } = req.body;
                const recentHistory = conversation.slice(-5).map((m: any) => `${m.role}: ${(m.text || '').substring(0, 200)}`).join('\n');
                const prompt = `Suggest 3 short follow-up questions. Return JSON array of strings. Do not use markdown code blocks.\n\nCONVERSATION:\n${recentHistory}\n\nJSON SUGGESTIONS:`;
                try {
                    const text = await generateProviderCompletion(activeProviderName, chatApiKey, model, prompt, undefined, true);
                    let suggestions = [];
                    try { 
                        const cleanText = text.replace(/```json\n?|\n?```/g, '').trim();
                        suggestions = JSON.parse(cleanText || '[]'); 
                    } catch (e) {}
                    if (!Array.isArray(suggestions)) suggestions = [];
                    res.status(200).json({ suggestions });
                } catch (e) { res.status(200).json({ suggestions: [] }); }
                break;
            }
            case 'tts': {
                if (!auxAi) throw new Error("TTS Unavailable: Google Gemini API key not configured in settings.");
                const { text, voice, model } = req.body;
                try {
                    const audio = await executeTextToSpeech(auxAi, text, voice, model);
                    res.status(200).json({ audio });
                } catch (e) {
                    res.status(500).json({ error: parseApiError(e) });
                }
                break;
            }
            case 'enhance': {
                const { userInput, prompt } = req.body;
                // Support both userInput (legacy) and prompt (AI SDK compatible)
                const input = userInput || prompt;
                
                const enhancementPrompt = `
You are an expert Prompt Engineer. Rewrite this input into a highly effective prompt.

USER INPUT: "${input}"

Output ONLY the raw text of the improved prompt.
`;
                res.setHeader('Content-Type', 'text/plain');
                try {
                    const text = await generateProviderCompletion(activeProviderName, chatApiKey, 'gemini-3-flash-preview', enhancementPrompt); 
                    res.write(text);
                } catch (e) { res.write(input); }
                res.end();
                break;
            }
            case 'memory_suggest': {
                const { conversation } = req.body;
                try {
                    const suggestions = await executeExtractMemorySuggestions(activeProviderName, chatApiKey, activeModel, conversation);
                    res.status(200).json({ suggestions });
                } catch (e) { res.status(200).json({ suggestions: [] }); }
                break;
            }
            case 'memory_consolidate': {
                const { currentMemory, suggestions } = req.body;
                try {
                    const memory = await executeConsolidateMemory(activeProviderName, chatApiKey, activeModel, currentMemory, suggestions);
                    res.status(200).json({ memory });
                } catch (e) { res.status(200).json({ memory: [currentMemory, ...suggestions].filter(Boolean).join('\n') }); }
                break;
            }
            case 'run_piston': {
                const { language, code } = req.body;
                try {
                    const result = await executeWithPiston(language, code);
                    res.status(200).json({ result });
                } catch (e) {
                    const parsedError = parseApiError(e);
                    res.status(500).json({ error: parsedError.message });
                }
                break;
            }
            case 'debug_data_tree': {
                const dataPath = path.join((process as any).cwd(), 'data');
                const ascii = `data/\n` + await generateAsciiTree(dataPath);
                const structure = await generateDirectoryStructure(dataPath);
                res.status(200).json({ ascii, json: structure });
                break;
            }
            // Count Tokens Task
            case 'count_tokens': {
                const { newMessage, model } = req.body;
                let textToCount = "";
                
                if (newMessage) {
                    if (newMessage.text) textToCount += newMessage.text;
                    // Approximate token count for images/files if exact not possible easily
                    // This is a rough estimation for UX purposes
                    if (newMessage.attachments) textToCount += ` [${newMessage.attachments.length} attachments]`;
                }

                try {
                    // If using Gemini, we can use countTokens API. 
                    // For others, we might need a local estimator or just return 0/mock.
                    if (activeProviderName === 'gemini' && chatApiKey) {
                         const ai = new GoogleGenAI({ apiKey: chatApiKey });
                         // Updated to use ai.models.countTokens instead of deprecated getGenerativeModel
                         const countResult = await ai.models.countTokens({
                             model: model || 'gemini-2.5-flash',
                             contents: [{ parts: [{ text: textToCount }] }]
                         });
                         res.status(200).json({ totalTokens: countResult.totalTokens });
                    } else {
                         // Fallback estimation: ~4 chars per token
                         const estimated = Math.ceil(textToCount.length / 4);
                         res.status(200).json({ totalTokens: estimated });
                    }
                } catch (e) {
                    // Fallback on error
                    res.status(200).json({ totalTokens: Math.ceil(textToCount.length / 4) });
                }
                break;
            }
            default:
                res.status(404).json({ error: `Unknown task: ${task}` });
        }
    } catch (error) {
        console.error(`[HANDLER] Error processing task "${task}":`, error);
        const parsedError = parseApiError(error);
        if (!res.headersSent) {
            res.status(500).json({ error: parsedError });
        }
    }
};
