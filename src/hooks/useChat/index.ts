
/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useMemo, useCallback, useRef, useEffect } from 'react';
import { v4 as uuidv4 } from 'uuid';
import { useMachine } from '@xstate/react';
import { fromPromise } from 'xstate';
import { chatMachine } from '../../machines/chatMachine';
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

    // References for async operations
    const abortControllerRef = useRef<AbortController | null>(null);
    const requestIdRef = useRef<string | null>(null); 
    const testResolverRef = useRef<((value: Message | PromiseLike<Message>) => void) | null>(null);
    
    // Track title generation attempts
    const titleGenerationAttemptedRef = useRef<Set<string>>(new Set());

    // Refs to access latest state inside async callbacks (XState actors)
    const chatHistoryRef = useRef(chatHistory);
    useEffect(() => { chatHistoryRef.current = chatHistory; }, [chatHistory]);
    const currentChatIdRef = useRef(currentChatId);
    useEffect(() => { currentChatIdRef.current = currentChatId; }, [currentChatId]);

    const messages = useMemo(() => {
        return chatHistory.find(c => c.id === currentChatId)?.messages || [];
    }, [chatHistory, currentChatId]);

    // --- Backend Chat Logic (Invoked by XState) ---
    const executeBackendRequest = async (
        task: 'chat' | 'regenerate',
        chatId: string,
        messageId: string, 
        newMessage: Message | null,
        chatConfig: Pick<ChatSession, 'model' | 'temperature' | 'maxOutputTokens' | 'imageModel' | 'videoModel'>,
        runtimeSettings: { isAgentMode: boolean } & ChatSettings
    ) => {
        const controller = new AbortController();
        abortControllerRef.current = controller;

        try {
            const requestPayload = {
                chatId,
                messageId,
                model: chatConfig.model,
                newMessage, 
                settings: {
                    isAgentMode: false,
                    systemPrompt: runtimeSettings.systemPrompt,
                    aboutUser: runtimeSettings.aboutUser,
                    aboutResponse: runtimeSettings.aboutResponse,
                    temperature: chatConfig.temperature,
                    maxOutputTokens: chatConfig.maxOutputTokens || undefined,
                    imageModel: runtimeSettings.imageModel,
                    videoModel: runtimeSettings.videoModel,
                    memoryContent,
                }
            };

            const response = await fetchFromApi(`/api/handler?task=${task}`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                signal: controller.signal,
                body: JSON.stringify(requestPayload),
            });

            if (!response.ok) {
                let errorMessage = `Request failed with status ${response.status}`;
                try {
                    const errorJson = await response.json();
                    errorMessage = errorJson.error?.message || errorJson.error || errorMessage;
                } catch { }
                throw new Error(errorMessage);
            }
            
            if (!response.body) throw new Error("Response body is missing");
            
            const callbacks = createStreamCallbacks({
                chatId,
                messageId,
                updateActiveResponseOnMessage,
                updateMessage,
                completeChatLoading,
                handleFrontendToolExecution: () => {},
                onStart: (requestId) => { requestIdRef.current = requestId; },
                onCancel: () => controller.abort()
            });

            await processBackendStream(response, callbacks, controller.signal);

        } catch (error: any) {
            if (error.message === 'Version mismatch') {
                // Global handler takes care of this
            } else if (error.name !== 'AbortError') {
                console.error('[FRONTEND] Backend stream failed.', error);
                updateActiveResponseOnMessage(chatId, messageId, () => ({ error: parseApiError(error), endTime: Date.now() }));
                throw error; // Re-throw to inform XState
            }
        } finally {
            const wasAborted = controller.signal.aborted;
            if (abortControllerRef.current === controller) {
                abortControllerRef.current = null;
                requestIdRef.current = null;
            }
            if (!wasAborted) {
                updateMessage(chatId, messageId, { isThinking: false });
                completeChatLoading(chatId);
                handlePostChatActions(chatId, messageId, apiKey);
            } else {
                updateMessage(chatId, messageId, { isThinking: false });
                completeChatLoading(chatId);
            }
        }
    };

    // --- XState Machine ---
    const [state, send] = useMachine(chatMachine, {
        actions: {
            setChatDetails: ({ event }) => {
                // Used to sync external state into machine context if needed
            },
            setError: ({ event }) => {
                const errorMsg = (event as any).error;
                if (onShowToast) onShowToast(errorMsg, 'error');
            }
        },
        actors: {
            invokeBackend: fromPromise(async ({ input }: { input: any }) => {
                const { event } = input;
                
                // Logic extraction for SEND_MESSAGE
                if (event.type === 'SEND_MESSAGE') {
                    const userMessageText = event.userMessage;
                    const files = event.files;
                    
                    const currentHistory = chatHistoryRef.current;
                    let activeChatId = currentChatIdRef.current;
                    let currentChat = activeChatId ? currentHistory.find(c => c.id === activeChatId) : undefined;
                    let chatCreationPromise: Promise<ChatSession | null> | null = null;

                    if (!activeChatId || !currentChat) {
                        const optimisticId = generateId(); 
                        activeChatId = optimisticId;
                        
                        const settingsToUse = {
                            temperature: settings.temperature,
                            maxOutputTokens: settings.maxOutputTokens,
                            imageModel: settings.imageModel,
                            videoModel: settings.videoModel,
                            isAgentMode: false,
                        };

                        chatCreationPromise = startNewChatHistory(initialModel, settingsToUse, optimisticId);
                        
                        currentChat = {
                            id: optimisticId,
                            title: "New Chat",
                            messages: [],
                            model: initialModel,
                            createdAt: Date.now(),
                            ...settingsToUse
                        } as ChatSession;
                    }

                    // Process Attachments
                    const attachmentsData = files?.length ? await Promise.all(files.map(async (f: File) => ({ name: f.name, mimeType: f.type, data: await fileToBase64(f) }))) : undefined;

                    // Optimistic UI Updates
                    const userMessageObj: Message = { id: generateId(), role: 'user', text: userMessageText, isHidden: false, attachments: attachmentsData, activeResponseIndex: 0 };
                    addMessagesToChat(activeChatId, [userMessageObj]);

                    const modelPlaceholder: Message = { id: generateId(), role: 'model', text: '', responses: [{ text: '', toolCallEvents: [], startTime: Date.now() }], activeResponseIndex: 0, isThinking: true };
                    addMessagesToChat(activeChatId, [modelPlaceholder]);
                    setChatLoadingState(activeChatId, true);

                    if (chatCreationPromise) {
                        const created = await chatCreationPromise;
                        if (!created) throw new Error("Failed to create chat");
                    }

                    const chatForSettings = currentChat || { model: initialModel, ...settings };

                    await executeBackendRequest(
                        'chat',
                        activeChatId as string,
                        modelPlaceholder.id,
                        userMessageObj,
                        chatForSettings,
                        { ...settings, isAgentMode: false }
                    );
                }

                // Logic extraction for REGENERATE
                if (event.type === 'REGENERATE') {
                    const aiMessageId = event.messageId;
                    const chatId = currentChatIdRef.current;
                    if (!chatId) return;

                    const currentChat = chatHistoryRef.current.find(c => c.id === chatId); 
                    if (!currentChat || !currentChat.messages) return;

                    const messageIndex = currentChat.messages.findIndex(m => m.id === aiMessageId);
                    
                    const updatedMessages = JSON.parse(JSON.stringify(currentChat.messages)) as Message[];
                    const targetMessage = updatedMessages[messageIndex];

                    // Ensure responses array is initialized
                    if (!targetMessage.responses) targetMessage.responses = [];
                    
                    // Create new response branch
                    const newResponse: ModelResponse = { text: '', toolCallEvents: [], startTime: Date.now() };
                    targetMessage.responses.push(newResponse);
                    targetMessage.activeResponseIndex = targetMessage.responses.length - 1;
                    targetMessage.isThinking = true;

                    const truncatedList = [...updatedMessages.slice(0, messageIndex), targetMessage];

                    await updateChatProperty(chatId, { messages: truncatedList });
                    setChatLoadingState(chatId, true);

                    await executeBackendRequest(
                        'regenerate',
                        chatId,
                        aiMessageId, 
                        null, 
                        currentChat, 
                        { ...settings, isAgentMode: false }
                    );
                }
            })
        }
    });

    const isLoading = state.matches('generating');

    // Post-chat operations (Title generation, Suggestions)
    const handlePostChatActions = async (chatId: string, messageId: string, key: string) => {
        const finalChatState = chatHistoryRef.current.find(c => c.id === chatId);
        if (!finalChatState || !finalChatState.messages) return;

        // 1. Generate Title
        if (finalChatState.title === "New Chat" && finalChatState.messages.length >= 2 && !titleGenerationAttemptedRef.current.has(chatId)) {
            titleGenerationAttemptedRef.current.add(chatId);
            generateChatTitle(finalChatState.messages, finalChatState.model)
                .then(newTitle => {
                    const finalTitle = newTitle.length > 45 ? newTitle.substring(0, 42) + '...' : newTitle;
                    updateChatTitle(chatId, finalTitle);
                })
                .catch(err => console.error("Failed to generate chat title:", err));
        }

        // 2. Suggestions
        if (key) {
            const suggestions = await generateFollowUpSuggestions(finalChatState.messages, finalChatState.model);
            if (suggestions.length > 0) {
                updateActiveResponseOnMessage(chatId, messageId, () => ({ suggestedActions: suggestions }));
                
                const currentChatSnapshot = chatHistoryRef.current.find(c => c.id === chatId);
                if (currentChatSnapshot && currentChatSnapshot.messages) {
                     const updatedMessages = currentChatSnapshot.messages.map(m => {
                        if (m.id === messageId) {
                            const responses = m.responses ? [...m.responses] : [];
                            if (responses[m.activeResponseIndex]) {
                                responses[m.activeResponseIndex] = {
                                    ...responses[m.activeResponseIndex],
                                    suggestedActions: suggestions
                                };
                            }
                            return { ...m, responses, isThinking: false };
                        }
                        return m;
                    });
                    updateChatProperty(chatId, { messages: updatedMessages });
                }
            }
        }
    };

    // Public API Actions
    const sendMessage = useCallback((userMessage: string, files?: File[], options: { isHidden?: boolean; isThinkingModeEnabled?: boolean } = {}) => {
        if (isLoading) return;
        send({ type: 'SEND_MESSAGE', userMessage, files });
    }, [isLoading, send]);

    const regenerateResponse = useCallback((messageId: string) => {
        if (isLoading) cancelGeneration();
        send({ type: 'REGENERATE', messageId });
    }, [isLoading, send]);

    const cancelGeneration = useCallback(() => {
        abortControllerRef.current?.abort();
        const chatId = currentChatIdRef.current;
        
        if (chatId) {
            fetchFromApi('/api/handler?task=cancel', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ requestId: chatId }),
                silent: true
            }).catch(console.error);
        }
        send({ type: 'CANCEL' });
    }, [send]);

    // Test Harness
    useEffect(() => {
        if (!isLoading && testResolverRef.current && currentChatId) {
            const chat = chatHistory.find(c => c.id === currentChatId);
            if (chat && chat.messages && chat.messages.length > 0) {
                const lastMessage = chat.messages[chat.messages.length - 1];
                if (lastMessage.role === 'model') {
                    testResolverRef.current(lastMessage);
                    testResolverRef.current = null;
                }
            }
        }
    }, [isLoading, chatHistory, currentChatId]);

    const sendMessageForTest = (userMessage: string, options?: { isThinkingModeEnabled?: boolean }): Promise<Message> => {
        return new Promise((resolve) => {
            testResolverRef.current = resolve;
            sendMessage(userMessage, undefined, options);
        });
    };

    // Branch Navigation Logic (Purely local state manipulation via useChatHistory, no machine needed for this)
    const navigateBranch = useCallback(async (messageId: string, direction: 'next' | 'prev') => {
        if (isLoading) return;
        const chatId = currentChatIdRef.current;
        if (!chatId) return;

        const currentChat = chatHistoryRef.current.find(c => c.id === chatId);
        if (!currentChat || !currentChat.messages) return;

        const messageIndex = currentChat.messages.findIndex(m => m.id === messageId);
        if (messageIndex === -1) return;

        const updatedMessages = JSON.parse(JSON.stringify(currentChat.messages)) as Message[];
        const targetMessage = updatedMessages[messageIndex];

        if (!targetMessage.versions || targetMessage.versions.length < 2) return;

        const currentIndex = targetMessage.activeVersionIndex ?? 0;
        let newIndex = direction === 'next' ? currentIndex + 1 : currentIndex - 1;
        
        if (newIndex < 0) newIndex = 0;
        if (newIndex >= targetMessage.versions.length) newIndex = targetMessage.versions.length - 1;
        if (newIndex === currentIndex) return;

        // Save active payload
        const currentFuture = updatedMessages.slice(messageIndex + 1);
        targetMessage.versions[currentIndex].historyPayload = currentFuture;

        // Restore target payload
        const targetVersion = targetMessage.versions[newIndex];
        const restoredFuture = targetVersion.historyPayload || [];

        targetMessage.text = targetVersion.text;
        targetMessage.attachments = targetVersion.attachments;
        targetMessage.activeVersionIndex = newIndex;

        const newMessagesList = [...updatedMessages.slice(0, messageIndex), targetMessage, ...restoredFuture];
        await updateChatProperty(chatId, { messages: newMessagesList });
    }, [isLoading, updateChatProperty]);

    const setResponseIndex = useCallback(async (messageId: string, index: number) => {
        if (isLoading) return; 
        const chatId = currentChatIdRef.current;
        if (!chatId) return;

        const currentChat = chatHistoryRef.current.find(c => c.id === chatId);
        if (!currentChat || !currentChat.messages) return;

        const messageIndex = currentChat.messages.findIndex(m => m.id === messageId);
        if (messageIndex === -1) return;

        const updatedMessages = JSON.parse(JSON.stringify(currentChat.messages)) as Message[];
        const targetMessage = updatedMessages[messageIndex];

        if (!targetMessage.responses || targetMessage.responses.length < 2) return;

        const currentIndex = targetMessage.activeResponseIndex;
        if (index < 0 || index >= targetMessage.responses.length) return;
        if (index === currentIndex) return;

        const currentFuture = updatedMessages.slice(messageIndex + 1);
        targetMessage.responses[currentIndex].historyPayload = currentFuture;

        const targetResponse = targetMessage.responses[index];
        const restoredFuture = targetResponse.historyPayload || [];

        targetMessage.activeResponseIndex = index;

        const newMessagesList = [...updatedMessages.slice(0, messageIndex), targetMessage, ...restoredFuture];
        await updateChatProperty(chatId, { messages: newMessagesList });
    }, [isLoading, updateChatProperty]);

    const editMessage = useCallback(async (messageId: string, newText: string) => {
        if (isLoading) cancelGeneration();
        const chatId = currentChatIdRef.current;
        if (!chatId) return;

        const currentChat = chatHistoryRef.current.find(c => c.id === chatId);
        if (!currentChat || !currentChat.messages) return;

        const messageIndex = currentChat.messages.findIndex(m => m.id === messageId);
        if (messageIndex === -1) return;

        const updatedMessages = JSON.parse(JSON.stringify(currentChat.messages)) as Message[];
        const targetMessage = updatedMessages[messageIndex];
        const futureMessages = updatedMessages.slice(messageIndex + 1);
        
        // Versioning Logic
        const currentVersionIndex = targetMessage.activeVersionIndex ?? 0;
        
        if (!targetMessage.versions || targetMessage.versions.length === 0) {
            targetMessage.versions = [{
                text: targetMessage.text,
                attachments: targetMessage.attachments,
                createdAt: Date.now(),
                historyPayload: futureMessages
            }];
        } else {
            targetMessage.versions[currentVersionIndex].historyPayload = futureMessages;
        }

        const newVersionIndex = targetMessage.versions.length;
        targetMessage.versions.push({
            text: newText,
            attachments: targetMessage.attachments, 
            createdAt: Date.now(),
            historyPayload: [] 
        });

        targetMessage.activeVersionIndex = newVersionIndex;
        targetMessage.text = newText;

        const truncatedList = [...updatedMessages.slice(0, messageIndex), targetMessage];
        await updateChatProperty(chatId, { messages: truncatedList });
        
        // Trigger regeneration
        const modelPlaceholder: Message = { 
            id: generateId(), 
            role: 'model', 
            text: '', 
            responses: [{ text: '', toolCallEvents: [], startTime: Date.now() }], 
            activeResponseIndex: 0, 
            isThinking: true 
        };
        addMessagesToChat(chatId, [modelPlaceholder]);
        setChatLoadingState(chatId, true);
        
        // Using direct backend call wrapper to bypass simplified machine event for regenerate
        // because REGENERATE event expects an existing messageId, but here we created a fresh one.
        // We reuse logic by manually creating the promise if needed, or better, leverage machine logic.
        // For simplicity in this XState refactor, let's use the executeBackendRequest directly here
        // or trigger a SEND like event.
        
        // Let's use the unified executor since XState is "driving" the UI state
        await executeBackendRequest(
            'regenerate', 
            chatId,
            modelPlaceholder.id,
            null, 
            currentChat, 
            { ...settings, isAgentMode: false }
        );

    }, [isLoading, cancelGeneration, updateChatProperty, addMessagesToChat, setChatLoadingState, settings]);

    const updateChatModel = useCallback((chatId: string, model: string, debounceMs: number = 0) => updateChatProperty(chatId, { model }, debounceMs), [updateChatProperty]);
    const updateChatSettings = useCallback((chatId: string, settings: Partial<Pick<ChatSession, 'temperature' | 'maxOutputTokens' | 'imageModel' | 'videoModel'>>, debounceMs: number = 0) => updateChatProperty(chatId, settings, debounceMs), [updateChatProperty]);

    return { 
        chatHistory, currentChatId, isHistoryLoading,
        updateChatTitle, updateChatProperty, loadChat: loadChatHistory, deleteChat: deleteChatHistory, clearAllChats: clearAllChatsHistory, importChat, startNewChat: startNewChatHistory,
        messages, 
        sendMessage, 
        isLoading, 
        cancelGeneration, 
        regenerateResponse, 
        sendMessageForTest, 
        editMessage, 
        navigateBranch, 
        setResponseIndex, 
        updateChatModel, 
        updateChatSettings
    };
};
