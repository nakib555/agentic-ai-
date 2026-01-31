/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState, useCallback, useRef, useEffect } from 'react';
import { v4 as uuidv4 } from 'uuid';
import { type Message, type ChatSession } from '../../types';
import { fileToBase64 } from '../../utils/fileUtils';
import { useChatHistory } from '../useChatHistory';
import { generateChatTitle, parseApiError } from '../../services/gemini/index';
import { fetchFromApi } from '../../utils/api';
import { processBackendStream } from '../../services/agenticLoop/stream-processor';
import { createStreamCallbacks } from './chat-callbacks';
import { createBranchForUserMessage, createBranchForModelResponse, navigateBranch as navigateBranchFn } from './branching';

const generateId = () => uuidv4();

type ChatSettings = { 
    systemPrompt: string; 
    aboutUser?: string;
    aboutResponse?: string;
    temperature: number; 
    maxOutputTokens: number; 
    imageModel: string;
    videoModel: string;
};

export const useChat = (
    initialModel: string, 
    settings: ChatSettings, 
    memoryContent: string, 
    apiKey: string,
    onShowToast?: (message: string, type: 'info' | 'success' | 'error') => void
) => {
    const { 
        chatHistory, 
        currentChatId, 
        isHistoryLoading,
        updateChatTitle, 
        updateChatProperty,
        updateMessage,
        setChatLoadingState,
        completeChatLoading,
        updateActiveResponseOnMessage,
        addMessagesToChat,
        startNewChat: startNewChatHistory,
        loadChat: loadChatHistory,
        deleteChat: deleteChatHistory,
        clearAllChats: clearAllChatsHistory,
        importChat
    } = useChatHistory();

    const [isLoading, setIsLoading] = useState(false);
    const abortControllerRef = useRef<AbortController | null>(null);
    const requestIdRef = useRef<string | null>(null); 
    const testResolverRef = useRef<((value: Message | PromiseLike<Message>) => void) | null>(null);

    // --- DEPENDENCY REF PATTERN ---
    // Access latest props/state inside async functions without closure staleness
    const depsRef = useRef({
        chatHistory,
        currentChatId,
        settings,
        initialModel,
        memoryContent,
        apiKey,
        startNewChatHistory,
        addMessagesToChat,
        updateChatProperty,
        setChatLoadingState,
        updateActiveResponseOnMessage,
        updateMessage,
        completeChatLoading,
        onShowToast,
        updateChatTitle
    });

    useEffect(() => {
        depsRef.current = {
            chatHistory,
            currentChatId,
            settings,
            initialModel,
            memoryContent,
            apiKey,
            startNewChatHistory,
            addMessagesToChat,
            updateChatProperty,
            setChatLoadingState,
            updateActiveResponseOnMessage,
            updateMessage,
            completeChatLoading,
            onShowToast,
            updateChatTitle
        };
    });

    // --- Actions ---

    const abortCurrent = useCallback(() => {
        if (abortControllerRef.current) {
            console.log('[useChat] Aborting current request');
            abortControllerRef.current.abort();
            abortControllerRef.current = null;
        }
    }, []);

    const performGeneration = useCallback(async (input: any) => {
        console.log('[useChat] performGeneration INVOKED', input);
        const deps = depsRef.current;
        const { task, newMessage, updatedMessages, rawEvent } = input;
        
        setIsLoading(true);
        let activeChatId = input.chatId;
        
        try {
            // 1. Handle New Chat Creation (Optimistic)
            if (!activeChatId && task === 'chat') {
                console.log('[useChat] Creating new chat session...');
                const optimisticId = generateId();
                activeChatId = optimisticId;
                
                const settingsToUse = {
                    temperature: deps.settings.temperature,
                    maxOutputTokens: deps.settings.maxOutputTokens,
                    imageModel: deps.settings.imageModel,
                    videoModel: deps.settings.videoModel,
                };

                try {
                    await deps.startNewChatHistory(deps.initialModel, settingsToUse, optimisticId);
                } catch (err) {
                    console.error("[useChat] Failed to start new chat:", err);
                    if (deps.onShowToast) deps.onShowToast("Failed to create new chat session. Check backend connection.", 'error');
                    throw err;
                }
            }

            // 2. Handle Message Persistence (Optimistic UI)
            if (task === 'chat' && newMessage) {
                 // Process Attachments
                 const files = rawEvent?.files;
                 let attachmentsData;
                 if (files && files.length > 0) {
                     try {
                         attachmentsData = await Promise.all(files.map(async (f: File) => ({ name: f.name, mimeType: f.type, data: await fileToBase64(f) })));
                     } catch (e) {
                         console.error("[useChat] Failed to process files:", e);
                         throw new Error("Failed to process attached files.");
                     }
                 }
                 
                 // Construct User Message
                 const userMsg: Message = { ...newMessage, attachments: attachmentsData, activeResponseIndex: 0 };
                 
                 // Construct AI Placeholder
                 const aiMsg: Message = { 
                     id: generateId(), 
                     role: 'model', 
                     text: '', 
                     responses: [{ text: '', toolCallEvents: [], startTime: Date.now() }], 
                     activeResponseIndex: 0, 
                     isThinking: true 
                 };

                 // Persist (Appends to current branch)
                 deps.addMessagesToChat(activeChatId, [userMsg, aiMsg]);
                 deps.setChatLoadingState(activeChatId, true);
                 
                 // Define target ID for streaming
                 input.messageId = aiMsg.id; 
            } 
            else if (updatedMessages) {
                 // For Regenerate/Edit
                 await deps.updateChatProperty(activeChatId, { messages: updatedMessages });
                 deps.setChatLoadingState(activeChatId, true);
            }

            // 3. Initiate Stream
            const controller = new AbortController();
            abortControllerRef.current = controller;

            const chatForConfig = deps.chatHistory.find(c => c.id === activeChatId) || { model: deps.initialModel, ...deps.settings };
            
            // Defensively construct payload
            const safeNewMessage = task === 'chat' 
                ? (updatedMessages 
                    ? null 
                    : { 
                        ...(input.newMessage || {}),
                        text: input.newMessage?.text || rawEvent?.text || '' 
                      }
                  ) 
                : null;

            const requestPayload = {
                chatId: activeChatId,
                messageId: input.messageId,
                model: chatForConfig.model,
                newMessage: safeNewMessage,
                settings: {
                    systemPrompt: deps.settings.systemPrompt,
                    aboutUser: deps.settings.aboutUser,
                    aboutResponse: deps.settings.aboutResponse,
                    temperature: chatForConfig.temperature,
                    maxOutputTokens: chatForConfig.maxOutputTokens || undefined,
                    imageModel: deps.settings.imageModel,
                    videoModel: deps.settings.videoModel,
                    memoryContent: deps.memoryContent,
                }
            };
            
            if (task === 'chat' && requestPayload.newMessage && requestPayload.newMessage.text) {
                 const files = rawEvent?.files;
                 if (files?.length) {
                     const attachmentsData = await Promise.all(files.map(async (f: File) => ({ name: f.name, mimeType: f.type, data: await fileToBase64(f) })));
                     requestPayload.newMessage.attachments = attachmentsData;
                 }
            }

            console.log('[useChat] Sending API request...', requestPayload);
            const response = await fetchFromApi(`/api/handler?task=${task}`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                signal: controller.signal,
                body: JSON.stringify(requestPayload),
            });

            if (!response.ok) throw new Error(`Request failed: ${response.status}`);
            if (!response.body) throw new Error("No response body");

            console.log('[useChat] Response received, starting stream processing...');
            const callbacks = createStreamCallbacks({
                chatId: activeChatId,
                messageId: input.messageId,
                updateActiveResponseOnMessage: deps.updateActiveResponseOnMessage,
                updateMessage: deps.updateMessage,
                completeChatLoading: deps.completeChatLoading,
                handleFrontendToolExecution: () => {},
                onStart: (requestId) => { requestIdRef.current = requestId; },
                onCancel: () => controller.abort()
            });

            await processBackendStream(response, callbacks, controller.signal);

        } catch (error: any) {
            if (error.name !== 'AbortError') {
                console.error('[useChat] Stream error:', error);
                if (activeChatId && input.messageId) {
                    deps.updateActiveResponseOnMessage(activeChatId, input.messageId, () => ({ error: parseApiError(error), endTime: Date.now() }));
                }
                if (deps.onShowToast) deps.onShowToast("Generation failed: " + error.message, 'error');
            }
        } finally {
             // Cleanup logic
             const wasAborted = abortControllerRef.current?.signal.aborted;
             if (abortControllerRef.current) {
                abortControllerRef.current = null;
                requestIdRef.current = null;
             }
             
             if (activeChatId) {
                 deps.completeChatLoading(activeChatId);
                 if (input.messageId) {
                    deps.updateMessage(activeChatId, input.messageId, { isThinking: false });
                 }
                 
                 // Auto-generate title for new chats
                 if (!wasAborted && task === 'chat') {
                     const finalChatState = deps.chatHistory.find(c => c.id === activeChatId) 
                        || { id: activeChatId, messages: [], title: 'New Chat', model: deps.initialModel } as any;

                     if (finalChatState && finalChatState.title === "New Chat") {
                         generateChatTitle(finalChatState.messages || [], finalChatState.model)
                            .then(newTitle => {
                                const finalTitle = newTitle.length > 45 ? newTitle.substring(0, 42) + '...' : newTitle;
                                deps.updateChatTitle(activeChatId, finalTitle);
                            })
                            .catch(() => {});
                     }
                 }
             }
             setIsLoading(false);
        }
    }, []); 

    const sendMessage = useCallback((text: string, files?: File[], options: any = {}) => {
        abortCurrent();
        const activeChatId = depsRef.current.currentChatId;

        performGeneration({ 
            task: 'chat',
            chatId: activeChatId, // if null, performGeneration creates new chat
            newMessage: { 
                id: crypto.randomUUID(), 
                role: 'user', 
                text, 
            },
            rawEvent: { text, files },
            settings: options // Pass options if needed, though they aren't fully utilized in this simplified flow yet
        });
    }, [performGeneration, abortCurrent]);

    const regenerateResponse = useCallback((messageId: string) => {
        abortCurrent();
        const deps = depsRef.current;
        if (!deps.currentChatId) return;
        const currentChat = deps.chatHistory.find(c => c.id === deps.currentChatId);
        if (!currentChat) return;

        const result = createBranchForModelResponse(currentChat.messages, messageId);
        if (!result) return;

        performGeneration({ 
            task: 'regenerate', 
            chatId: currentChat.id,
            messageId, // Target AI message ID
            updatedMessages: result.updatedMessages,
            currentChat, 
            settings: { ...deps.settings } 
        });
    }, [performGeneration, abortCurrent]);

    const editMessage = useCallback((messageId: string, newText: string) => {
        abortCurrent();
        const deps = depsRef.current;
        if (!deps.currentChatId) return;
        const currentChat = deps.chatHistory.find(c => c.id === deps.currentChatId);
        if (!currentChat) return;
        
        const result = createBranchForUserMessage(currentChat.messages, messageId, newText);
        if (!result) return;

        const modelPlaceholderId = crypto.randomUUID();

        performGeneration({
            task: 'regenerate',
            chatId: currentChat.id,
            messageId: modelPlaceholderId, // New AI response ID
            updatedMessages: [
                ...result.updatedMessages, 
                 { 
                    id: modelPlaceholderId, 
                    role: 'model', 
                    text: '', 
                    responses: [{ text: '', toolCallEvents: [], startTime: Date.now() }], 
                    activeResponseIndex: 0, 
                    isThinking: true 
                }
            ],
            currentChat,
            settings: { ...deps.settings }
        });
    }, [performGeneration, abortCurrent]);

    const navigateBranch = useCallback(async (messageId: string, direction: 'next' | 'prev') => {
        abortCurrent();
        const deps = depsRef.current;
        if (!deps.currentChatId) return;
        const currentChat = deps.chatHistory.find(c => c.id === deps.currentChatId);
        if (!currentChat) return;

        const result = navigateBranchFn(currentChat.messages, messageId, direction);
        if (!result) return;

        try {
            await deps.updateChatProperty(deps.currentChatId, { messages: result.updatedMessages });
        } catch (e) {
            if (deps.onShowToast) deps.onShowToast("Failed to switch branch", 'error');
        }
    }, [abortCurrent]);

    const cancelGeneration = useCallback(() => {
        const deps = depsRef.current;
        abortCurrent();
        if (deps.currentChatId) {
             fetchFromApi('/api/handler?task=cancel', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ requestId: deps.currentChatId }),
                silent: true
            }).catch(console.error);
        }
        setIsLoading(false);
    }, [abortCurrent]);

    // Helpers for switching view-only response index (no persistence)
    const setResponseIndex = useCallback(async (messageId: string, index: number) => {
        const deps = depsRef.current;
        if (!deps.currentChatId) return;
        deps.updateActiveResponseOnMessage(deps.currentChatId, messageId, () => ({})); // Trigger update
        deps.updateMessage(deps.currentChatId, messageId, { activeResponseIndex: index });
    }, []);
    
    // Legacy bridging for Test Harness
    const sendMessageForTest = (userMessage: string, options?: any): Promise<Message> => {
        return new Promise((resolve) => {
            testResolverRef.current = resolve;
            sendMessage(userMessage, undefined, options);
        });
    };
    
    // Resolver trigger for tests
    useEffect(() => {
        if (!isLoading && testResolverRef.current && currentChatId) {
            const chat = chatHistory.find(c => c.id === currentChatId);
            if (chat && chat.messages?.length) {
                testResolverRef.current(chat.messages[chat.messages.length - 1]);
                testResolverRef.current = null;
            }
        }
    }, [isLoading, chatHistory, currentChatId]);

    const unifiedHistory = chatHistory.map(c => c.id === currentChatId ? (chatHistory.find(ch => ch.id === currentChatId) || c) : c);

    return { 
        chatHistory: unifiedHistory, 
        currentChatId, 
        isHistoryLoading,
        updateChatTitle, updateChatProperty, loadChat: loadChatHistory, deleteChat: deleteChatHistory, clearAllChats: clearAllChatsHistory, importChat, startNewChat: startNewChatHistory,
        messages: unifiedHistory.find(c => c.id === currentChatId)?.messages || [], 
        sendMessage, 
        isLoading, 
        cancelGeneration, 
        regenerateResponse, 
        sendMessageForTest, 
        editMessage, 
        navigateBranch, 
        setResponseIndex, 
        updateChatModel: (id: string, m: string) => updateChatProperty(id, { model: m }), 
        updateChatSettings: (id: string, s: any) => updateChatProperty(id, s)
    };
};