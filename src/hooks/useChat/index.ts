
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

    // Refs to access latest state inside async callbacks (XState Services)
    const chatHistoryRef = useRef(chatHistory);
    useEffect(() => { chatHistoryRef.current = chatHistory; }, [chatHistory]);
    
    const currentChatIdRef = useRef(currentChatId);
    useEffect(() => { currentChatIdRef.current = currentChatId; }, [currentChatId]);

    const settingsRef = useRef(settings);
    useEffect(() => { settingsRef.current = settings; }, [settings]);

    // ------------------------------------------------------------------------
    // SERVICE ADAPTERS
    // ------------------------------------------------------------------------

    const performGenerationService = useCallback(async (input: any) => {
        const { task, newMessage, updatedMessages, currentChat, rawEvent } = input;
        
        // Use settings from Ref to prevent service recreation on settings change
        const runtimeSettings = settingsRef.current;

        let activeChatId = input.chatId;
        
        // 1. Handle New Chat Creation (Optimistic)
        if (!activeChatId && task === 'chat') {
            const optimisticId = generateId();
            activeChatId = optimisticId;
            
            const settingsToUse = {
                temperature: runtimeSettings.temperature,
                maxOutputTokens: runtimeSettings.maxOutputTokens,
                imageModel: runtimeSettings.imageModel,
                videoModel: runtimeSettings.videoModel,
            };

            // Fire and forget creation, rely on optimistic ID
            // We await here to ensure the chat exists in the cache before adding messages
            await startNewChatHistory(initialModel, settingsToUse, optimisticId);
        }

        // 2. Handle Message Persistence (Optimistic UI)
        if (task === 'chat' && newMessage && rawEvent) {
             // Process Attachments if any (from the raw event files)
             const files = rawEvent.files;
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
             addMessagesToChat(activeChatId, [userMsg, aiMsg]);
             setChatLoadingState(activeChatId, true);
             
             // Define target ID for streaming
             input.messageId = aiMsg.id; 
        } 
        else if (updatedMessages) {
             // For Regenerate/Edit, we receive the fully computed tree.
             // We must persist this state before starting the stream so the UI reflects the branch.
             await updateChatProperty(activeChatId, { messages: updatedMessages });
             setChatLoadingState(activeChatId, true);
        }

        // 3. Initiate Stream
        const controller = new AbortController();
        abortControllerRef.current = controller;

        try {
            // Re-read settings for runtime accuracy
            const chatForConfig = chatHistoryRef.current.find(c => c.id === activeChatId) || { model: initialModel, ...runtimeSettings };
            
            const requestPayload = {
                chatId: activeChatId,
                messageId: input.messageId,
                model: chatForConfig.model,
                newMessage: task === 'chat' ? (updatedMessages ? null : { text: rawEvent.text, ...input.newMessage }) : null,
                settings: {
                    systemPrompt: runtimeSettings.systemPrompt,
                    aboutUser: runtimeSettings.aboutUser,
                    aboutResponse: runtimeSettings.aboutResponse,
                    temperature: chatForConfig.temperature,
                    maxOutputTokens: chatForConfig.maxOutputTokens || undefined,
                    imageModel: runtimeSettings.imageModel,
                    videoModel: runtimeSettings.videoModel,
                    memoryContent,
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
                updateActiveResponseOnMessage,
                updateMessage,
                completeChatLoading,
                handleFrontendToolExecution: () => {},
                onStart: (requestId) => { requestIdRef.current = requestId; },
                onCancel: () => controller.abort()
            });

            await processBackendStream(response, callbacks, controller.signal);

        } catch (error: any) {
            if (error.name !== 'AbortError') {
                console.error('[CHAT_MACHINE] Stream error:', error);
                updateActiveResponseOnMessage(activeChatId, input.messageId, () => ({ error: parseApiError(error), endTime: Date.now() }));
                if (onShowToast) onShowToast("Generation failed", 'error');
            }
            throw error;
        } finally {
             const wasAborted = controller.signal.aborted;
             if (abortControllerRef.current === controller) {
                abortControllerRef.current = null;
                requestIdRef.current = null;
             }
             updateMessage(activeChatId, input.messageId, { isThinking: false });
             completeChatLoading(activeChatId);
             
             if (!wasAborted) {
                 handlePostChatActions(activeChatId, input.messageId, apiKey);
             }
        }
    }, [
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
        onShowToast
    ]);

    const persistBranchService = useCallback(async (input: { chatId: string, messages: Message[] }) => {
        try {
            await updateChatProperty(input.chatId, { messages: input.messages });
        } catch (e) {
            if (onShowToast) onShowToast("Failed to switch branch", 'error');
            throw e;
        }
    }, [updateChatProperty, onShowToast]);

    // ------------------------------------------------------------------------
    // XSTATE MACHINE
    // ------------------------------------------------------------------------

    // Memoize actors to prevent machine reset on every render
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
            initialModel
        });
    }, [sendWithServices, initialModel]);

    const regenerateResponse = useCallback((messageId: string) => {
        abortCurrent();
        if (!currentChatIdRef.current) return;
        const currentChat = chatHistoryRef.current.find(c => c.id === currentChatIdRef.current);
        if (!currentChat) return;

        sendWithServices({ 
            type: 'REGENERATE', 
            messageId, 
            currentChat, 
            settings: { ...settingsRef.current } 
        });
    }, [sendWithServices]);

    const editMessage = useCallback((messageId: string, newText: string) => {
        abortCurrent();
        if (!currentChatIdRef.current) return;
        const currentChat = chatHistoryRef.current.find(c => c.id === currentChatIdRef.current);
        if (!currentChat) return;
        
        sendWithServices({
            type: 'EDIT',
            messageId,
            newText,
            currentChat,
            settings: { ...settingsRef.current }
        });
    }, [sendWithServices]);

    const navigateBranch = useCallback((messageId: string, direction: 'next' | 'prev') => {
        abortCurrent();
        if (!currentChatIdRef.current) return;
        const currentChat = chatHistoryRef.current.find(c => c.id === currentChatIdRef.current);
        if (!currentChat) return;

        sendWithServices({
            type: 'NAVIGATE',
            messageId,
            direction,
            currentChat
        });
    }, [sendWithServices]);

    const cancelGeneration = useCallback(() => {
        // Abort the fetch
        abortCurrent();
        // Inform backend
        if (currentChatIdRef.current) {
             fetchFromApi('/api/handler?task=cancel', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ requestId: currentChatIdRef.current }),
                silent: true
            }).catch(console.error);
        }
        // Tell machine to stop
        sendWithServices({ type: 'STOP' });
    }, [sendWithServices]);

    const handlePostChatActions = async (chatId: string, messageId: string, key: string) => {
        const finalChatState = chatHistoryRef.current.find(c => c.id === chatId);
        if (!finalChatState || !finalChatState.messages) return;

        if (finalChatState.title === "New Chat" && finalChatState.messages.length >= 2) {
             generateChatTitle(finalChatState.messages, finalChatState.model)
                .then(newTitle => {
                    const finalTitle = newTitle.length > 45 ? newTitle.substring(0, 42) + '...' : newTitle;
                    updateChatTitle(chatId, finalTitle);
                })
                .catch(() => {});
        }
    };
    
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
        if (!currentChatIdRef.current) return;
        const currentChat = chatHistoryRef.current.find(c => c.id === currentChatIdRef.current);
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
        updateChatProperty(currentChatIdRef.current, { messages: newMessagesList });
        
    }, [updateChatProperty]);

    return { 
        chatHistory: chatHistory.map(c => c.id === currentChatId ? (chatHistoryRef.current.find(refC => refC.id === c.id) || c) : c), 
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
