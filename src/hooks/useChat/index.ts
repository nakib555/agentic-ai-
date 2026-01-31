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
import { generateChatTitle, parseApiError, generateFollowUpSuggestions } from '../../services/gemini/index';
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
        const deps = depsRef.current; // Access latest deps
        const { task, newMessage, updatedMessages, currentChat, rawEvent } = input;
        
        let activeChatId = input.chatId;
        
        // 1. Handle New Chat Creation (Optimistic)
        if (!activeChatId && task === 'chat') {
            const optimisticId = generateId();
            activeChatId = optimisticId;
            
            const settingsToUse = {
                temperature: deps.settings.temperature,
                maxOutputTokens: deps.settings.maxOutputTokens,
                imageModel: deps.settings.imageModel,
                videoModel: deps.settings.videoModel,
            };

            // Fire and forget creation, rely on optimistic ID
            // This updates the local cache synchronously, so subsequent steps can find the chat
            await deps.startNewChatHistory(deps.initialModel, settingsToUse, optimisticId);
        }

        // 2. Handle Message Persistence (Optimistic UI)
        if (task === 'chat' && newMessage) {
             // Process Attachments
             const files = rawEvent?.files;
             const attachmentsData = files?.length ? await Promise.all(files.map(async (f: File) => ({ name: f.name, mimeType: f.type, data: await fileToBase64(f) }))) : undefined;
             
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

             // Persist
             // We use activeChatId which might be the optimistic ID created in step 1
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

        try {
            // Note: deps.chatHistory might be stale in this closure if a new chat was just created.
            // We use the optimistic activeChatId and fallback settings if finding fails.
            const chatForConfig = deps.chatHistory.find(c => c.id === activeChatId) || { model: deps.initialModel, ...deps.settings };
            
            // Defensively construct the newMessage payload for the backend
            const safeNewMessage = task === 'chat' 
                ? (updatedMessages 
                    ? null 
                    : { 
                        ...(input.newMessage || {}),
                        // Ensure text is present, falling back to rawEvent if input.newMessage was incomplete
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
            
            // Allow attachments to be properly formatted if this was a new chat msg
            if (task === 'chat' && requestPayload.newMessage && requestPayload.newMessage.text) {
                 const files = rawEvent?.files;
                 if (files?.length) {
                     const attachmentsData = await Promise.all(files.map(async (f: File) => ({ name: f.name, mimeType: f.type, data: await fileToBase64(f) })));
                     requestPayload.newMessage.attachments = attachmentsData;
                 }
            }

            const response = await fetchFromApi(`/api/handler?task=${task}`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                signal: controller.signal,
                body: JSON.stringify(requestPayload),
            });

            if (!response.ok) throw new Error(`Request failed: ${response.status}`);
            if (!response.body) throw new Error("No response body");

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
                if (deps.onShowToast) deps.onShowToast("Generation failed", 'error');
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
                 // Handle Post Chat Actions (Title Gen)
                 // Re-fetch chat from cache to get latest messages state
                 const finalChatState = deps.chatHistory.find(c => c.id === activeChatId) 
                    // Fallback to searching in fresh deps via ref if possible, but depsRef is only updated on render
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
    }, []); // ZERO DEPENDENCIES = STABLE REFERENCE

    const persistBranchService = useCallback(async (input: { chatId: string, messages: Message[] }) => {
        const deps = depsRef.current;
        try {
            await deps.updateChatProperty(input.chatId, { messages: input.messages });
        } catch (e) {
            if (deps.onShowToast) deps.onShowToast("Failed to switch branch", 'error');
            throw e;
        }
    }, []); // ZERO DEPENDENCIES = STABLE REFERENCE

    // ------------------------------------------------------------------------
    // XSTATE MACHINE
    // ------------------------------------------------------------------------

    const actors = useMemo(() => ({
        performGeneration: fromPromise(async ({ input }: any) => {
            return performGenerationService(input);
        }),
        persistBranch: fromPromise(async ({ input }: any) => {
            return persistBranchService(input);
        })
    }), [performGenerationService, persistBranchService]);

    const [stateWithServices, sendWithServices] = useMachine(chatMachine, {
        input: { chatId: currentChatId, model: initialModel },
        actors
    } as any);

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
        abortCurrent();
        sendWithServices({ 
            type: 'SEND', 
            text, 
            files, 
            settings: options,
            initialModel,
            chatId: currentChatId // Pass explicit ID
        });
    }, [sendWithServices, initialModel, currentChatId]);

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
    
    // Resolver trigger
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

    // Helpers
    const setResponseIndex = useCallback(async (messageId: string, index: number) => {
        const deps = depsRef.current;
        if (!deps.currentChatId) return;
        const currentChat = deps.chatHistory.find(c => c.id === deps.currentChatId);
        if (!currentChat) return;
        
        const updatedMessages = JSON.parse(JSON.stringify(currentChat.messages)) as Message[];
        const targetMessage = updatedMessages.find(m => m.id === messageId);
        if (!targetMessage || !targetMessage.responses) return;
        
        const currentIndex = targetMessage.activeResponseIndex;
        if (index === currentIndex) return;
        
        const currentFuture = updatedMessages.slice(updatedMessages.indexOf(targetMessage) + 1);
        targetMessage.responses[currentIndex].historyPayload = currentFuture;
        
        const targetResponse = targetMessage.responses[index];
        targetMessage.activeResponseIndex = index;
        const restoredFuture = targetResponse.historyPayload || [];
        
        const newMessagesList = [...updatedMessages.slice(0, updatedMessages.indexOf(targetMessage)), targetMessage, ...restoredFuture];
        deps.updateChatProperty(deps.currentChatId, { messages: newMessagesList });
        
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
        updateChatSettings: (id: string, s: any) => updateChatProperty(id, s),
        addModelResponse: () => {}
    };
};