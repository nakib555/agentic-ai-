
/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { Request as ExpressRequest, Response as ExpressResponse } from 'express';
import path from 'path';
import { CHAT_PERSONA_AND_UI_FORMATTING as chatModeSystemInstruction } from './prompts/chatPersona';
import { parseApiError } from './utils/apiError';
import { getApiKey, getProvider, getGeminiKey } from './settingsHandler';
import { historyControl } from './services/historyControl';
import { vectorMemory } from './services/vectorMemory';
import { readData, SETTINGS_FILE_PATH } from './data-store';
import { providerRegistry } from './providers/registry'; 
import { GoogleGenAI } from "@google/genai";
import { jobManager, Job } from './services/jobManager';
import { ChatPersistenceManager } from './services/persistence';
import * as taskHandlers from './services/taskHandlers';
import { generateAsciiTree, generateDirectoryStructure } from './utils/fileTree';

export const apiHandler = async (req: any, res: any) => {
    const task = req.query.task as string;
    
    // --- RECONNECTION HANDLING ---
    if (task === 'connect') {
        const { chatId } = req.body; 
        const job = jobManager.get(chatId);
        
        if (!job) {
            return res.status(200).json({ status: "stream_not_found" });
        }
        
        // Force NDJSON content type and disable buffering
        res.setHeader('Content-Type', 'application/x-ndjson');
        res.setHeader('Cache-Control', 'no-cache, no-transform');
        res.setHeader('X-Accel-Buffering', 'no');
        res.setHeader('Connection', 'keep-alive');
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
    let activeProviderName = req.body.provider || await getProvider();
    let chatApiKey = req.body.apiKey;
    
    if (!chatApiKey) {
        if (activeProviderName === await getProvider()) {
            chatApiKey = await getApiKey();
        } else {
            try {
                const settings: any = await readData(SETTINGS_FILE_PATH);
                if (activeProviderName === 'openrouter') chatApiKey = settings.openRouterApiKey || process.env.OPENROUTER_API_KEY;
                else if (activeProviderName === 'ollama') chatApiKey = settings.ollamaApiKey || process.env.OLLAMA_API_KEY;
                else chatApiKey = settings.apiKey || process.env.API_KEY || process.env.GEMINI_API_KEY;
            } catch (e) {
                chatApiKey = await getApiKey();
            }
        }
    }
    
    const geminiKey = await getGeminiKey();
    const globalSettings: any = await readData(SETTINGS_FILE_PATH);
    const defaultModel = globalSettings.activeModel || 'gemini-2.5-flash';

    const isSuggestionTask = ['title', 'suggestions', 'enhance', 'memory_suggest', 'memory_consolidate', 'run_piston', 'fix_code'].includes(task);
    const BYPASS_TASKS = ['cancel', 'debug_data_tree', 'feedback', 'count_tokens', 'tool_exec', 'tool_response'];
    
    if (!chatApiKey && !BYPASS_TASKS.includes(task) && !isSuggestionTask && activeProviderName !== 'ollama') {
        return res.status(401).json({ error: "API key not configured for the selected provider." });
    }
    
    const auxAi = (geminiKey) ? new GoogleGenAI({ apiKey: geminiKey }) : null;
    if (auxAi) await vectorMemory.init(auxAi);

    try {
        switch (task) {
            case 'chat': 
            case 'regenerate': {
                const { chatId, settings, newMessage, messageId } = req.body;
                let model = req.body.model || defaultModel;
                
                let savedChat = await historyControl.getChat(chatId);
                if (!savedChat) return res.status(404).json({ error: "Chat not found" });

                let historyMessages = savedChat.messages || [];
                let historyForAI: any[] = [];

                if (task === 'chat' && newMessage) {
                    historyMessages.push(newMessage);
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

                if (jobManager.has(chatId)) {
                    jobManager.cleanup(chatId);
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
                jobManager.set(chatId, job);

                res.setHeader('Content-Type', 'application/x-ndjson');
                res.setHeader('Cache-Control', 'no-cache, no-transform');
                res.setHeader('X-Accel-Buffering', 'no');
                res.setHeader('Connection', 'keep-alive');
                res.setHeader('Transfer-Encoding', 'chunked');
                res.flushHeaders();

                jobManager.writeToClient(job, 'start', { requestId: chatId });
                const pingInterval = setInterval(() => jobManager.writeToClient(job, 'ping', {}), 10000);
                
                req.on('close', () => { job.clients.delete(res); });

                let ragContext = "";
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
                    finalSystemInstruction = `# ⚙️ SYSTEM KERNEL (IMMUTABLE PROTOCOLS)\n${coreInstruction}\n\n================================================================================\n\n# 🧩 CONTEXTUAL LAYER (PERSONALIZATION)\n${personalizationSection}`.trim();
                }

                try {
                    const provider = await providerRegistry.getProvider(activeProviderName);
                    await provider.chat({
                        model,
                        messages: historyForAI,
                        newMessage,
                        systemInstruction: finalSystemInstruction,
                        temperature: settings.temperature,
                        maxTokens: settings.maxOutputTokens,
                        apiKey: chatApiKey,
                        isAgentMode: false,
                        signal: abortController.signal,
                        chatId,
                        callbacks: {
                            onTextChunk: (text) => {
                                jobManager.writeToClient(job, 'text-chunk', text);
                                persistence.addText(text);
                            },
                            onNewToolCalls: () => {},
                            onToolResult: () => {},
                            onPlanReady: () => Promise.resolve(false),
                            onFrontendToolRequest: () => {},
                            onComplete: (data) => {
                                jobManager.writeToClient(job, 'complete', data);
                                persistence.complete((r) => {
                                    r.endTime = Date.now();
                                    if (data.groundingMetadata) r.groundingMetadata = data.groundingMetadata;
                                });
                                if (data.finalText.length > 50 && auxAi) {
                                    vectorMemory.addMemory(data.finalText, { chatId, role: 'model' }).catch(console.error);
                                }
                            },
                            onError: (err) => {
                                const parsed = parseApiError(err);
                                jobManager.writeToClient(job, 'error', parsed);
                                persistence.complete((r) => { r.error = parsed; r.endTime = Date.now(); });
                            },
                            onCancel: () => {
                                jobManager.writeToClient(job, 'cancel', {});
                                persistence.complete();
                            }
                        }
                    });

                } catch (e: any) {
                    const parsedError = parseApiError(e);
                    jobManager.writeToClient(job, 'error', parsedError);
                    persistence.complete((response) => { response.error = parsedError; });
                } finally {
                    clearInterval(pingInterval);
                    jobManager.cleanup(chatId);
                }
                break;
            }
            case 'cancel': {
                const { requestId } = req.body;
                let job = jobManager.get(requestId);
                if (job) {
                    job.controller.abort();
                    res.status(200).send({ message: 'Cancellation request received.' });
                } else {
                    res.status(404).json({ error: `No active job found for ID: ${requestId}` });
                }
                break;
            }
            case 'feedback': {
                res.status(200).json({ status: 'ok' });
                break;
            }
            case 'title': return taskHandlers.handleTitle(req, res, activeProviderName, chatApiKey, defaultModel);
            case 'suggestions': return taskHandlers.handleSuggestions(req, res, activeProviderName, chatApiKey, defaultModel);
            case 'tts': return taskHandlers.handleTTS(req, res, auxAi);
            case 'enhance': return taskHandlers.handleEnhance(req, res, activeProviderName, chatApiKey);
            case 'fix_code': return taskHandlers.handleFixCode(req, res, activeProviderName, chatApiKey, defaultModel);
            case 'memory_suggest': return taskHandlers.handleMemorySuggest(req, res, activeProviderName, chatApiKey, defaultModel);
            case 'memory_consolidate': return taskHandlers.handleMemoryConsolidate(req, res, activeProviderName, chatApiKey, defaultModel);
            case 'run_piston': return taskHandlers.handleRunPiston(req, res);
            case 'count_tokens': return taskHandlers.handleCountTokens(req, res, activeProviderName, chatApiKey, defaultModel);
            case 'debug_data_tree': {
                const dataPath = path.join((process as any).cwd(), 'data');
                const ascii = `data/\n` + await generateAsciiTree(dataPath);
                const structure = await generateDirectoryStructure(dataPath);
                res.status(200).json({ ascii, json: structure });
                break;
            }
            case 'tool_exec': {
                 const { toolName, toolArgs } = req.body;
                 const { createToolExecutor } = await import('./tools/index');
                 if (!toolName) return res.status(400).json({ error: { message: "Tool name is required" } });
                 const ai = new GoogleGenAI({ apiKey: chatApiKey! });
                 const executor = createToolExecutor(ai, globalSettings.imageModel, globalSettings.videoModel, chatApiKey!, "temp_id", async () => ({ error: "Frontend tools not supported" }));
                 try {
                     const result = await executor(toolName, toolArgs, "direct-call");
                     res.status(200).json({ result });
                 } catch (e: any) {
                     res.status(500).json({ error: parseApiError(e) });
                 }
                 break;
            }
            default: res.status(404).json({ error: `Unknown task: ${task}` });
        }
    } catch (error) {
        const parsedError = parseApiError(error);
        if (!res.headersSent) res.status(500).json({ error: parsedError });
    }
};
