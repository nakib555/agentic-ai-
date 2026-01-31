
/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useMemo, useCallback, useRef, useEffect } from 'react';
import { v4 as uuidv4 } from 'uuid';
import { useMachine } from '@xstate/react';
import { fromPromise } from 'xstate';
import { chatMachine } from './chatMachine';
import { type Message, type ChatSession, ModelResponse } from '../../types';
import { fileToBase64 } from '../../utils/fileUtils';
import { useChatHistory } from '../useChatHistory';
import { generateChatTitle, parseApiError } from '../../services/gemini/index';
import { fetchFromApi } from '../../utils/api';
import { processBackendStream } from '../../services/agenticLoop/stream-processor';
import { createStreamCallbacks } from './chat-callbacks';

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

    const abortControllerRef = useRef<AbortController | null>(null);
    const requestIdRef = useRef<string | null>(null); 
    const testResolverRef = useRef<((value: Message | PromiseLike<Message>) => void) | null>(null);

    // --- DEPENDENCY REF PATTERN ---
    // Keeps service closures fresh without breaking XState actor references
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

    // ------------------------------------------------------------------------
    // SERVICE ADAPTERS (Stable References)
    // ------------------------------------------------------------------------

    const performGenerationService = useCallback(async (input: any) => {
        console.log('[useChat] performGenerationService INVOKED', input);
        const deps = depsRef.current; // Access latest deps
        const { task, newMessage, updatedMessages, rawEvent } = input;
        
        let activeChatId = input.chatId;
        
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

            // Fire and forget creation, rely on optimistic ID
            try {
                await deps.startNewChatHistory(deps.initialModel, settingsToUse, optimisticId);
            } catch (err) {
                console.error("[useChat] Failed to start new chat:", err);
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
             // For Regenerate/Edit (Branch created by Machine Input factory)
             await deps.updateChatProperty(activeChatId, { messages: updatedMessages });
             deps.setChatLoadingState(activeChatId, true);
        }

        // 3. Initiate Stream
        const controller = new AbortController();
        abortControllerRef.current = controller;

        try {
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
                console.error('[CHAT_MACHINE] Stream error:', error);
                deps.updateActiveResponseOnMessage(activeChatId, input.messageId, () => ({ error: parseApiError(error), endTime: Date.now() }));
                if (deps.onShowToast) deps.onShowToast("Generation failed: " + error.message, 'error');
            }
            throw error;
        } finally {
             const wasAborted = controller.signal.aborted;
             if (abortControllerRef.current === controller) {
                abortControllerRef.current = null;
                requestIdRef.current = null;
             }
             deps.updateMessage(activeChatId, input.messageId, { isThinking: false });
             deps.completeChatLoading(activeChatId);
             
             if (!wasAborted) {
                 // Auto-generate title for new chats
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
    }, []); 

    const persistBranchService = useCallback(async (input: { chatId: string, messages: Message[] }) => {
        const deps = depsRef.current;
        try {
            await deps.updateChatProperty(input.chatId, { messages: input.messages });
        } catch (e) {
            if (deps.onShowToast) deps.onShowToast("Failed to switch branch", 'error');
            throw e;
        }
    }, []); 

    // ------------------------------------------------------------------------
    // XSTATE MACHINE
    // ------------------------------------------------------------------------

    const machineWithActors = useMemo(() => {
        console.log('[useChat] Providing actors to chatMachine');
        return chatMachine.provide({
            actors: {
                performGeneration: fromPromise(async ({ input }: any) => {
                    console.log('[useChat] Actor: performGeneration executing with input:', input);
                    try {
                        return await performGenerationService(input);
                    } catch (e) {
                        console.error('[useChat] Actor: performGeneration caught error:', e);
                        throw e;
                    }
                }),
                persistBranch: fromPromise(async ({ input }: any) => {
                    return persistBranchService(input);
                })
            }
        });
    }, [performGenerationService, persistBranchService]);

    const [stateWithServices, sendWithServices] = useMachine(machineWithActors, {
        input: { chatId: currentChatId, model: initialModel }
    });

    // Logging for debug
    useEffect(() => {
        console.log('[useChat] Machine State Update:', stateWithServices.value);
    }, [stateWithServices.value]);

    // ------------------------------------------------------------------------
    // PUBLIC ACTIONS (Mapped to Events)
    // ------------------------------------------------------------------------

    const abortCurrent = () => {
        if (abortControllerRef.current) {
            abortControllerRef.current.abort();
            abortControllerRef.current = null;
        }
    };

    const sendMessage = useCallback((text: string, files?: File[], options: any = {}) => {
        console.log('[useChat] sendMessage CALLED', { text, hasFiles: !!files, options, currentChatId, currentState: stateWithServices.value });
        abortCurrent();
        sendWithServices({ 
            type: 'SEND', 
            text, 
            files, 
            settings: options,
            initialModel,
            chatId: currentChatId 
        });
    }, [sendWithServices, initialModel, currentChatId, stateWithServices.value]);

    const regenerateResponse = useCallback((messageId: string) => {
        const deps = depsRef.current;
        abortCurrent();
        if (!deps.currentChatId) return;
        const currentChat = deps.chatHistory.find(c => c.id === deps.currentChatId);
        if (!currentChat) return;

        sendWithServices({ 
            type: 'REGENERATE', 
            messageId, 
            currentChat, 
            settings: { ...deps.settings } 
        });
    }, [sendWithServices]);

    const editMessage = useCallback((messageId: string, newText: string) => {
        const deps = depsRef.current;
        abortCurrent();
        if (!deps.currentChatId) return;
        const currentChat = deps.chatHistory.find(c => c.id === deps.currentChatId);
        if (!currentChat) return;
        
        sendWithServices({
            type: 'EDIT',
            messageId,
            newText,
            currentChat,
            settings: { ...deps.settings }
        });
    }, [sendWithServices]);

    const navigateBranch = useCallback((messageId: string, direction: 'next' | 'prev') => {
        const deps = depsRef.current;
        abortCurrent();
        if (!deps.currentChatId) return;
        const currentChat = deps.chatHistory.find(c => c.id === deps.currentChatId);
        if (!currentChat) return;

        sendWithServices({
            type: 'NAVIGATE',
            messageId,
            direction,
            currentChat
        });
    }, [sendWithServices]);

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
        sendWithServices({ type: 'STOP' });
    }, [sendWithServices]);
    
    // Legacy bridging for Test Harness
    const sendMessageForTest = (userMessage: string, options?: any): Promise<Message> => {
        return new Promise((resolve) => {
            testResolverRef.current = resolve;
            sendMessage(userMessage, undefined, options);
        });
    };
    
    // Resolver trigger for tests
    useEffect(() => {
        const loading = stateWithServices.matches('initializing_send') || stateWithServices.matches('initializing_regenerate');
        if (!loading && testResolverRef.current && currentChatId) {
            const chat = chatHistory.find(c => c.id === currentChatId);
            if (chat && chat.messages?.length) {
                testResolverRef.current(chat.messages[chat.messages.length - 1]);
                testResolverRef.current = null;
            }
        }
    }, [stateWithServices.value, chatHistory, currentChatId]);

    // Helpers for switching view-only response index (no persistence)
    const setResponseIndex = useCallback(async (messageId: string, index: number) => {
        const deps = depsRef.current;
        if (!deps.currentChatId) return;
        
        deps.updateActiveResponseOnMessage(deps.currentChatId, messageId, () => ({})); // Trigger update
        
        // This is a direct store update for UI responsiveness if not using the full navigate flow
        deps.updateMessage(deps.currentChatId, messageId, { activeResponseIndex: index });
    }, []);

    return { 
        chatHistory, 
        currentChatId, 
        isHistoryLoading,
        updateChatTitle, updateChatProperty, loadChat: loadChatHistory, deleteChat: deleteChatHistory, clearAllChats: clearAllChatsHistory, importChat, startNewChat: startNewChatHistory,
        messages: chatHistory.find(c => c.id === currentChatId)?.messages || [], 
        sendMessage, 
        isLoading: stateWithServices.matches('initializing_send') || stateWithServices.matches('initializing_regenerate') || stateWithServices.matches('initializing_edit'), 
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
