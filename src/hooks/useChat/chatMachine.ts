/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { setup, assign, fromPromise } from 'xstate';
import type { Message, ChatSession } from '../../types';
import { createBranchForUserMessage, createBranchForModelResponse, navigateBranch } from './branching';
import { v4 as uuidv4 } from 'uuid';

// --- Types ---

export type ChatContext = {
    chatId: string | null;
    model: string;
    // We keep a lightweight reference or necessary data. 
    // The massive message list is largely managed by React Query (persistence), 
    // but the machine needs to track specific IDs for operations.
    activeMessageId: string | null; 
    abortController: AbortController | null;
    error: string | null;
};

export type ChatEvent = 
    | { type: 'SEND'; text: string; files?: File[]; settings: any; initialModel: string; chatId: string | null }
    | { type: 'REGENERATE'; messageId: string; currentChat: ChatSession; settings: any }
    | { type: 'EDIT'; messageId: string; newText: string; currentChat: ChatSession; settings: any }
    | { type: 'NAVIGATE'; messageId: string; direction: 'next' | 'prev'; currentChat: ChatSession }
    | { type: 'STOP' }
    | { type: 'RETRY' }
    | { type: 'RESET' };

// --- Services (Side Effects) ---

// These are placeholders for the actual implementations passed from the hook
// because they depend on closure scope (api keys, persistence hooks)
type ChatServices = {
    performGeneration: {
        src: 'performGeneration';
        input: {
            task: 'chat' | 'regenerate';
            chatId: string;
            messageId: string;
            newMessage: Message | null;
            chatConfig: any;
            runtimeSettings: any;
            currentChat?: ChatSession;
        };
    };
    persistBranch: {
        src: 'persistBranch';
        input: {
            chatId: string;
            messages: Message[];
        }
    }
};

// --- Machine Definition ---

export const chatMachine = setup({
    types: {
        context: {} as ChatContext,
        events: {} as ChatEvent,
        input: {} as { chatId: string | null; model: string },
    },
    actions: {
        resetContext: assign({
            chatId: null,
            activeMessageId: null,
            error: null,
            abortController: null
        }),
        setError: assign({
            error: ({ event }) => (event as any).data?.message || 'Unknown error'
        }),
        setAbortController: assign({
            abortController: ({ event }) => (event as any).controller
        }),
        clearAbortController: assign({
            abortController: null
        })
    },
    actors: {
        // Defined in the hook via provide()
        performGeneration: fromPromise(async () => {}), 
        persistBranch: fromPromise(async () => {}),
    }
}).createMachine({
    id: 'chat',
    initial: 'idle',
    context: ({ input }) => ({
        chatId: input.chatId,
        model: input.model,
        activeMessageId: null,
        abortController: null,
        error: null
    }),
    states: {
        idle: {
            on: {
                SEND: 'initializing_send',
                REGENERATE: 'initializing_regenerate',
                EDIT: 'initializing_edit',
                NAVIGATE: 'navigating',
                RESET: { actions: 'resetContext', target: 'idle' }
            }
        },

        // --- Navigation Logic (Synchronous tree update) ---
        navigating: {
            invoke: {
                src: 'persistBranch',
                input: ({ context, event }) => {
                    if (event.type !== 'NAVIGATE') return { chatId: '', messages: [] };
                    const result = navigateBranch(event.currentChat.messages, event.messageId, event.direction);
                    if (!result) return { chatId: '', messages: [] }; // No-op if invalid
                    return {
                        chatId: event.currentChat.id,
                        messages: result.updatedMessages
                    };
                },
                onDone: 'idle',
                onError: {
                    target: 'idle',
                    actions: ({ event }) => console.error("Navigation failed", event)
                }
            },
            // Allow interruption even during navigation persistence (unlikely needed but consistent)
            on: {
                SEND: 'initializing_send',
                REGENERATE: 'initializing_regenerate',
                EDIT: 'initializing_edit'
            }
        },

        // --- Branching Logic (Preparing the tree) ---
        
        // 1. New Message
        initializing_send: {
            invoke: {
                src: 'performGeneration',
                input: ({ context, event }) => {
                    if (event.type !== 'SEND') return {} as any;
                    
                    // Prefer event.chatId (authoritative from React state) over context.chatId (stale xstate context)
                    const activeChatId = event.chatId || context.chatId;

                    return {
                        task: 'chat',
                        chatId: activeChatId, 
                        newMessage: { 
                            id: uuidv4(), 
                            role: 'user', 
                            text: event.text, 
                            // Files handling needs to be passed through
                        },
                        // We pass the raw event data to the service
                        // The service (hook) will construct the full payload
                        rawEvent: event 
                    };
                },
                onDone: 'idle', // Stream finished
                onError: 'failed'
            },
            on: { 
                STOP: 'stopping',
                // Allow interrupting current generation with a new action
                SEND: 'initializing_send',
                REGENERATE: 'initializing_regenerate',
                EDIT: 'initializing_edit',
                NAVIGATE: 'navigating'
            }
        },

        // 2. Regenerate (New Response Branch)
        initializing_regenerate: {
             invoke: {
                src: 'performGeneration',
                input: ({ context, event }) => {
                    if (event.type !== 'REGENERATE') return {} as any;
                    
                    const result = createBranchForModelResponse(event.currentChat.messages, event.messageId);
                    if (!result) throw new Error("Invalid regeneration target");

                    return {
                        task: 'regenerate',
                        chatId: event.currentChat.id,
                        messageId: event.messageId,
                        updatedMessages: result.updatedMessages,
                        currentChat: event.currentChat,
                        settings: event.settings
                    };
                },
                onDone: 'idle',
                onError: 'failed'
            },
            on: { 
                STOP: 'stopping',
                SEND: 'initializing_send',
                REGENERATE: 'initializing_regenerate',
                EDIT: 'initializing_edit',
                NAVIGATE: 'navigating'
            }
        },

        // 3. Edit (New User Branch)
        initializing_edit: {
            invoke: {
                src: 'performGeneration',
                input: ({ context, event }) => {
                    if (event.type !== 'EDIT') return {} as any;

                    const result = createBranchForUserMessage(event.currentChat.messages, event.messageId, event.newText);
                    if (!result) throw new Error("Invalid edit target");

                    // We need a placeholder AI message ID for the response to this edit
                    const modelPlaceholderId = uuidv4();

                    return {
                        task: 'regenerate', // Edit is technically a regeneration from a new user node
                        chatId: event.currentChat.id,
                        messageId: modelPlaceholderId, // The ID for the NEW AI message
                        updatedMessages: [
                            ...result.updatedMessages, 
                            // Add placeholder
                             { 
                                id: modelPlaceholderId, 
                                role: 'model', 
                                text: '', 
                                responses: [{ text: '', toolCallEvents: [], startTime: Date.now() }], 
                                activeResponseIndex: 0, 
                                isThinking: true 
                            }
                        ],
                        currentChat: event.currentChat,
                        settings: event.settings
                    };
                },
                onDone: 'idle',
                onError: 'failed'
            },
            on: { 
                STOP: 'stopping',
                SEND: 'initializing_send',
                REGENERATE: 'initializing_regenerate',
                EDIT: 'initializing_edit',
                NAVIGATE: 'navigating'
            }
        },

        // --- Common Flow States ---
        stopping: {
            entry: 'clearAbortController', // The hook handles the actual abort via ref, machine just tracks state
            always: 'idle'
        },
        
        failed: {
            entry: 'setError',
            on: {
                RETRY: {
                    target: 'idle', // Simplification: Retry logic usually requires re-triggering the last event
                },
                SEND: 'initializing_send', // Recovery via new action
                REGENERATE: 'initializing_regenerate',
                EDIT: 'initializing_edit',
                RESET: 'idle'
            }
        }
    }
});