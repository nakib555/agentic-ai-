/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useMemo, useCallback, useRef, useEffect } from 'react';
import { v4 as uuidv4 } from 'uuid';
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
    const hasAttemptedReconnection = useRef(false);
    
    // Track title generation attempts to avoid duplicate calls per session
    const titleGenerationAttemptedRef = useRef<Set<string>>(new Set());

    // Refs to access latest state inside async callbacks
    const chatHistoryRef = useRef(chatHistory);
    useEffect(() => { chatHistoryRef.current = chatHistory; }, [chatHistory]);
    const currentChatIdRef = useRef(currentChatId);
    useEffect(() => { currentChatIdRef.current = currentChatId; }, [currentChatId]);

    const messages = useMemo(() => {
        return chatHistory.find(c => c.id === currentChatId)?.messages || [];
    }, [chatHistory, currentChatId]);

    const isLoading = useMemo(() => {
        if (!currentChatId) return false;
        return chatHistory.find(c => c.id === currentChatId)?.isLoading ?? false;
    }, [chatHistory, currentChatId]);

    // Test harness resolver
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

    const cancelGeneration = useCallback(() => {
        abortControllerRef.current?.abort();
        
        const chatId = currentChatIdRef.current;
        if (!chatId) return;

        // Inform backend of cancellation
        if (chatId) {
            fetchFromApi('/api/handler?task=cancel', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ requestId: chatId }),
                silent: true
            }).catch(console.error);
        }
        
        // Update local state
        const currentChat = chatHistoryRef.current.find(c => c.id === chatId);
        if (currentChat?.messages?.length) {
            const lastMessage = currentChat.messages[currentChat.messages.length - 1];
            
            updateActiveResponseOnMessage(chatId, lastMessage.id, () => ({
                error: { 
                    code: 'STOPPED_BY_USER', 
                    message: 'Generation stopped by user.',
                    details: 'You interrupted the model.'
                },
                endTime: Date.now()
            }));
            updateMessage(chatId, lastMessage.id, { isThinking: false });
            completeChatLoading(chatId);
        }
    }, [updateActiveResponseOnMessage, updateMessage, completeChatLoading]);
    
    // --- RECONNECTION LOGIC ---
    const connectToActiveStream = useCallback(async (chatId: string, messageId: string) => {
        if (abortControllerRef.current) return; 

        console.log(`[FRONTEND] Attempting to reconnect to stream for chat ${chatId}...`);
        setChatLoadingState(chatId, true);
        
        const controller = new AbortController();
        abortControllerRef.current = controller;

        try {
            const response = await fetchFromApi('/api/handler?task=connect', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                signal: controller.signal,
                body: JSON.stringify({ chatId }),
                silent: true
            });

            if (!response.ok) {
                throw new Error(`Reconnection failed: ${response.status}`);
            }

            const contentType = response.headers.get("content-type");
            if (contentType && contentType.includes("application/json")) {
                const data = await response.json().catch(() => ({}));
                if (data.status === 'stream_not_found') {
                    console.log("[FRONTEND] Stream finished or expired. Closing local state.");
                    updateMessage(chatId, messageId, { isThinking: false });
                    completeChatLoading(chatId);
                    return;
                }
            }

            if (!response.body) throw new Error("No response body");

            const callbacks = createStreamCallbacks({
                chatId,
                messageId,
                updateActiveResponseOnMessage,
                updateMessage,
                completeChatLoading,
                handleFrontendToolExecution: () => {}, // No-op for reconnection
                onCancel: () => {
                    updateMessage(chatId, messageId, { isThinking: false });
                    completeChatLoading(chatId);
                }
            });

            await processBackendStream(response, callbacks, controller.signal);

        } catch (error) {
            console.error("[FRONTEND] Reconnection error:", error);
            updateMessage(chatId, messageId, { isThinking: false });
            completeChatLoading(chatId);
        } finally {
             if (abortControllerRef.current === controller) {
                abortControllerRef.current = null;
             }
        }
    }, [updateActiveResponseOnMessage, updateMessage, completeChatLoading, setChatLoadingState]);

    // Check for active streams on load
    useEffect(() => {
        if (hasAttemptedReconnection.current || !currentChatId) return;
        
        const chat = chatHistoryRef.current.find(c => c.id === currentChatId);
        if (chat && chat.messages && chat.messages.length > 0) {
            const lastMsg = chat.messages[chat.messages.length - 1];
            if (lastMsg.role === 'model' && lastMsg.isThinking && !abortControllerRef.current) {
                if (!lastMsg.responses?.[lastMsg.activeResponseIndex]?.error) {
                    hasAttemptedReconnection.current = true;
                    connectToActiveStream(currentChatId, lastMsg.id);
                }
            }
        }
    }, [currentChatId, connectToActiveStream]);

    // Reset reconnection flag on chat switch
    useEffect(() => {
        hasAttemptedReconnection.current = false;
    }, [currentChatId]);

    // Core function to initiate chat interaction with the backend
    const startBackendChat = async (
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
            // Construct the payload for the backend handler
            const requestPayload = {
                chatId,
                messageId,
                model: chatConfig.model,
                newMessage, // Only present for 'chat' task
                settings: {
                    isAgentMode: false, // Legacy flag, always false for standard chat
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
                } catch { /* use default message */ }
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
            }
        } finally {
            const wasAborted = controller.signal.aborted;
            
            // Cleanup controller reference if it matches current
            if (abortControllerRef.current === controller) {
                abortControllerRef.current = null;
                requestIdRef.current = null;
            }

            if (!wasAborted) {
                updateMessage(chatId, messageId, { isThinking: false });
                completeChatLoading(chatId);
                handlePostChatActions(chatId, messageId, apiKey);
            } else {
                 // Explicitly set state on abort to ensure UI reflects cancellation
                updateMessage(chatId, messageId, { isThinking: false });
                completeChatLoading(chatId);
            }
        }
    };
    
    // Post-chat operations (Title generation, Suggestions) extracted for cleanliness
    const handlePostChatActions = async (chatId: string, messageId: string, key: string) => {
        const finalChatState = chatHistoryRef.current.find(c => c.id === chatId);
        if (!finalChatState || !finalChatState.messages) return;

        // 1. Generate Title if New Chat
        if (finalChatState.title === "New Chat" && finalChatState.messages.length >= 2 && !titleGenerationAttemptedRef.current.has(chatId)) {
            titleGenerationAttemptedRef.current.add(chatId);
            generateChatTitle(finalChatState.messages, finalChatState.model)
                .then(newTitle => {
                    const finalTitle = newTitle.length > 45 ? newTitle.substring(0, 42) + '...' : newTitle;
                    updateChatTitle(chatId, finalTitle);
                })
                .catch(err => console.error("Failed to generate chat title:", err));
        }

        // 2. Generate Follow-up Suggestions
        if (key) {
            const suggestions = await generateFollowUpSuggestions(finalChatState.messages, finalChatState.model);
            if (suggestions.length > 0) {
                updateActiveResponseOnMessage(chatId, messageId, () => ({ suggestedActions: suggestions }));
                
                // Persist suggestion update
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

        // 3. Ensure final persistence (catch-all for state consistency)
        setTimeout(() => {
            const chatToPersist = chatHistoryRef.current.find(c => c.id === chatId);
            if (chatToPersist && chatToPersist.messages) {
                const cleanMessages = chatToPersist.messages.map(m => 
                    m.id === messageId ? { ...m, isThinking: false } : m
                );
                updateChatProperty(chatId, { messages: cleanMessages });
            }
        }, 200);
    };

    const sendMessage = async (userMessage: string, files?: File[], options: { isHidden?: boolean; isThinkingModeEnabled?: boolean } = {}) => {
        if (isLoading) return;
        requestIdRef.current = null; 
    
        const currentHistory = chatHistoryRef.current;
        let activeChatId = currentChatIdRef.current;
        let currentChat = activeChatId ? currentHistory.find(c => c.id === activeChatId) : undefined;
        let chatCreationPromise: Promise<ChatSession | null> | null = null;

        // Create new chat if needed
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
        const attachmentsData = files?.length ? await Promise.all(files.map(async f => ({ name: f.name, mimeType: f.type, data: await fileToBase64(f) }))) : undefined;
    
        // Optimistic UI Updates
        const userMessageObj: Message = { id: generateId(), role: 'user', text: userMessage, isHidden: options.isHidden, attachments: attachmentsData, activeResponseIndex: 0 };
        addMessagesToChat(activeChatId, [userMessageObj]);
    
        const modelPlaceholder: Message = { id: generateId(), role: 'model', text: '', responses: [{ text: '', toolCallEvents: [], startTime: Date.now() }], activeResponseIndex: 0, isThinking: true };
        addMessagesToChat(activeChatId, [modelPlaceholder]);
        setChatLoadingState(activeChatId, true);
    
        // Ensure creation finished before starting stream
        if (chatCreationPromise) {
            const created = await chatCreationPromise;
            if (!created) return;
        }

        const chatForSettings = currentChat || { model: initialModel, ...settings };

        await startBackendChat(
            'chat',
            activeChatId as string,
            modelPlaceholder.id, 
            userMessageObj,
            chatForSettings, 
            { ...settings, isAgentMode: false }
        );
    };

    const editMessage = useCallback(async (messageId: string, newText: string) => {
        if (isLoading) cancelGeneration();
        const chatId = currentChatIdRef.current;
        if (!chatId) return;

        const currentChat = chatHistoryRef.current.find(c => c.id === chatId);
        if (!currentChat || !currentChat.messages) return;

        const messageIndex = currentChat.messages.findIndex(m => m.id === messageId);
        if (messageIndex === -1) return;

        // Branching Logic
        const updatedMessages = JSON.parse(JSON.stringify(currentChat.messages)) as Message[];
        const targetMessage = updatedMessages[messageIndex];
        const futureMessages = updatedMessages.slice(messageIndex + 1);
        
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

        try {
            await updateChatProperty(chatId, { messages: truncatedList });
            
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

            await startBackendChat(
                'regenerate', 
                chatId,
                modelPlaceholder.id,
                null, 
                currentChat, 
                { ...settings, isAgentMode: false }
            );

        } catch (e) {
            console.error("Failed to edit message:", e);
            if (onShowToast) onShowToast("Failed to edit message branch", 'error');
        }
    }, [isLoading, updateChatProperty, addMessagesToChat, setChatLoadingState, startBackendChat, cancelGeneration, onShowToast, settings]);

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

        // Save current history payload
        const currentFuture = updatedMessages.slice(messageIndex + 1);
        targetMessage.versions[currentIndex].historyPayload = currentFuture;

        // Restore target history payload
        const targetVersion = targetMessage.versions[newIndex];
        const restoredFuture = targetVersion.historyPayload || [];

        targetMessage.text = targetVersion.text;
        targetMessage.attachments = targetVersion.attachments;
        targetMessage.activeVersionIndex = newIndex;

        const newMessagesList = [...updatedMessages.slice(0, messageIndex), targetMessage, ...restoredFuture];

        try {
            await updateChatProperty(chatId, { messages: newMessagesList });
        } catch (e) {
            console.error("Failed to switch branch:", e);
            if (onShowToast) onShowToast("Failed to switch branch", 'error');
        }

    }, [isLoading, updateChatProperty, onShowToast]);

    const regenerateResponse = useCallback(async (aiMessageId: string) => {
        if (isLoading) cancelGeneration();
        if (!currentChatId) return;

        requestIdRef.current = null; 

        const currentChat = chatHistoryRef.current.find(c => c.id === currentChatId); 
        if (!currentChat || !currentChat.messages) return;

        const messageIndex = currentChat.messages.findIndex(m => m.id === aiMessageId);
        if (messageIndex < 1 || currentChat.messages[messageIndex-1].role !== 'user') {
            console.error("Cannot regenerate: AI message is not preceded by a user message.");
            return;
        }
        
        const updatedMessages = JSON.parse(JSON.stringify(currentChat.messages)) as Message[];
        const targetMessage = updatedMessages[messageIndex];
        const currentResponseIndex = targetMessage.activeResponseIndex;

        // Save current response future
        const futureMessages = updatedMessages.slice(messageIndex + 1);
        if (targetMessage.responses && targetMessage.responses[currentResponseIndex]) {
            targetMessage.responses[currentResponseIndex].historyPayload = futureMessages;
        }

        // Create new response branch
        const newResponse: ModelResponse = { text: '', toolCallEvents: [], startTime: Date.now() };
        if (!targetMessage.responses) targetMessage.responses = [];
        targetMessage.responses.push(newResponse);
        targetMessage.activeResponseIndex = targetMessage.responses.length - 1;
        targetMessage.isThinking = true;

        const truncatedList = [...updatedMessages.slice(0, messageIndex), targetMessage];

        await updateChatProperty(currentChatId, { messages: truncatedList });
        setChatLoadingState(currentChatId, true);

        await startBackendChat(
            'regenerate',
            currentChatId, 
            aiMessageId, 
            null, 
            currentChat, 
            { ...settings, isAgentMode: false }
        );

    }, [isLoading, currentChatId, updateChatProperty, setChatLoadingState, cancelGeneration, startBackendChat, settings]);

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

        // Swap branches
        const currentFuture = updatedMessages.slice(messageIndex + 1);
        targetMessage.responses[currentIndex].historyPayload = currentFuture;

        const targetResponse = targetMessage.responses[index];
        const restoredFuture = targetResponse.historyPayload || [];

        targetMessage.activeResponseIndex = index;

        const newMessagesList = [...updatedMessages.slice(0, messageIndex), targetMessage, ...restoredFuture];

        try {
            await updateChatProperty(chatId, { messages: newMessagesList });
        } catch (e) {
            console.error("Failed to switch response branch:", e);
            if (onShowToast) onShowToast("Failed to switch response branch", 'error');
        }
    }, [isLoading, updateChatProperty, onShowToast]);

    const updateChatModel = useCallback((chatId: string, model: string, debounceMs: number = 0) => updateChatProperty(chatId, { model }, debounceMs), [updateChatProperty]);
    const updateChatSettings = useCallback((chatId: string, settings: Partial<Pick<ChatSession, 'temperature' | 'maxOutputTokens' | 'imageModel' | 'videoModel'>>, debounceMs: number = 0) => updateChatProperty(chatId, settings, debounceMs), [updateChatProperty]);

    const sendMessageForTest = (userMessage: string, options?: { isThinkingModeEnabled?: boolean }): Promise<Message> => {
        return new Promise((resolve) => {
            testResolverRef.current = resolve;
            sendMessage(userMessage, undefined, options);
        });
    };
  
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