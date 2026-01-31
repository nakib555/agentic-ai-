
/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { setup, assign, fromPromise } from 'xstate';
import type { Message, ChatSession } from '../../types';
import { createBranchForUserMessage, createBranchForModelResponse, navigateBranch } from './branching';

// --- Types ---

export type ChatContext = {
    chatId: string | null;
    model: string;
    error: string | null;
};

export type ChatEvent = 
    | { type: 'SEND'; text: string; files?: File[]; settings: any; initialModel: string; chatId: string | null }
    | { type: 'REGENERATE'; messageId: string; currentChat: ChatSession; settings: any }
    | { type: 'EDIT'; messageId: string; newText: string; currentChat: ChatSession; settings: any }
    | { type: 'NAVIGATE'; messageId: string; direction: 'next' | 'prev'; currentChat: ChatSession }
    | { type: 'STOP' }
    | { type: 'RESET' };

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
            error: null,
        }),
        setError: assign({
            error: ({ event }) => (event as any).data?.message || 'Unknown error'
        }),
        logTransition: ({ event }) => {
            console.log('[ChatMachine] Transitioning on event:', event.type);
        }
    },
    actors: {
        // Defined here as placeholders. These SHOULD be overridden by useChat's .provide().
        // If these run, it means injection failed.
        performGeneration: fromPromise(async () => {
             console.error("[ChatMachine] FATAL ERROR: Default performGeneration actor was executed. Service injection failed.");
             throw new Error("Internal Error: Logic not connected. Check useChat hook.");
        }), 
        persistBranch: fromPromise(async () => {
             console.error("[ChatMachine] FATAL ERROR: Default persistBranch actor was executed.");
             throw new Error("Internal Error: Logic not connected. Check useChat hook.");
        }),
    }
}).createMachine({
    id: 'chat',
    initial: 'idle',
    context: ({ input }) => ({
        chatId: input.chatId,
        model: input.model,
        error: null
    }),
    states: {
        idle: {
            on: {
                SEND: { target: 'initializing_send', actions: 'logTransition' },
                REGENERATE: { target: 'initializing_regenerate', actions: 'logTransition' },
                EDIT: { target: 'initializing_edit', actions: 'logTransition' },
                NAVIGATE: { target: 'navigating', actions: 'logTransition' },
                RESET: { actions: 'resetContext', target: 'idle' }
            }
        },

        // --- Navigation Logic (Switching active branches) ---
        navigating: {
            invoke: {
                src: 'persistBranch',
                input: ({ event }) => {
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
                    actions: ({ event }) => console.error("Navigation persistence failed", event)
                }
            },
            // Allow immediate interruption/override by new actions
            on: {
                SEND: 'initializing_send',
                REGENERATE: 'initializing_regenerate',
                EDIT: 'initializing_edit'
            }
        },

        // --- Branching & Generation Logic ---
        
        // 1. New Message (Linear or Branch Extension)
        initializing_send: {
            invoke: {
                src: 'performGeneration',
                input: ({ context, event }) => {
                    console.log('[ChatMachine] initializing_send input factory running', event);
                    if (event.type !== 'SEND') return {} as any;
                    
                    // Prefer event.chatId (authoritative) over context
                    const activeChatId = event.chatId || context.chatId;

                    return {
                        task: 'chat',
                        chatId: activeChatId, 
                        newMessage: { 
                            id: crypto.randomUUID(), 
                            role: 'user', 
                            text: event.text, 
                            // Files are processed by the service using rawEvent
                        },
                        rawEvent: event 
                    };
                },
                onDone: 'idle',
                onError: {
                    target: 'failed',
                    actions: ({ event }) => console.error('[ChatMachine] performGeneration failed', event)
                }
            },
            on: { 
                STOP: 'stopping'
            }
        },

        // 2. Regenerate (Forks a new AI Response Node)
        initializing_regenerate: {
             invoke: {
                src: 'performGeneration',
                input: ({ event }) => {
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
                STOP: 'stopping'
            }
        },

        // 3. Edit (Forks a new User Node + new AI Node)
        initializing_edit: {
            invoke: {
                src: 'performGeneration',
                input: ({ event }) => {
                    if (event.type !== 'EDIT') return {} as any;

                    const result = createBranchForUserMessage(event.currentChat.messages, event.messageId, event.newText);
                    if (!result) throw new Error("Invalid edit target");

                    // Create ID for the fresh AI response that will follow the edited user message
                    const modelPlaceholderId = crypto.randomUUID();

                    return {
                        task: 'regenerate', 
                        chatId: event.currentChat.id,
                        messageId: modelPlaceholderId,
                        updatedMessages: [
                            ...result.updatedMessages, 
                            // Add placeholder AI node
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
                STOP: 'stopping'
            }
        },

        // --- Flow Control States ---
        stopping: {
            always: 'idle'
        },
        
        failed: {
            entry: 'setError',
            on: {
                RETRY: 'idle',
                RESET: 'idle',
                // Allow immediate recovery via new actions
                SEND: 'initializing_send', 
                REGENERATE: 'initializing_regenerate',
                EDIT: 'initializing_edit'
            }
        }
    }
});
