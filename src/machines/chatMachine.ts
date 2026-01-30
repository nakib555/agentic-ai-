
import { setup, assign, fromPromise } from 'xstate';
import type { Message } from '../types';

export type ChatContext = {
    chatId: string | null;
    model: string;
    settings: any;
    messages: Message[];
    error: string | null;
};

export type ChatEvent = 
    | { type: 'START_CHAT'; chatId: string; model: string; settings: any }
    | { type: 'SEND_MESSAGE'; userMessage: string; files?: File[] }
    | { type: 'REGENERATE'; messageId: string }
    | { type: 'CANCEL' }
    | { type: 'RESET' }
    | { type: 'STREAM_COMPLETE' }
    | { type: 'ERROR'; error: string };

export const chatMachine = setup({
    types: {
        context: {} as ChatContext,
        events: {} as ChatEvent,
    },
    actors: {
        // The actual API call logic will be injected from the hook
        invokeBackend: fromPromise(async ({ input }: { input: any }) => {
            return input.run();
        }),
    },
    actions: {
        setChatDetails: assign({
            chatId: ({ event }) => (event as any).chatId,
            model: ({ event }) => (event as any).model,
            settings: ({ event }) => (event as any).settings,
        }),
        setError: assign({
            error: ({ event }) => (event as any).error,
        }),
        clearError: assign({ error: null }),
    },
}).createMachine({
    id: 'chat',
    initial: 'idle',
    context: {
        chatId: null,
        model: '',
        settings: {},
        messages: [],
        error: null,
    },
    states: {
        idle: {
            on: {
                START_CHAT: {
                    actions: 'setChatDetails',
                    target: 'idle',
                },
                SEND_MESSAGE: {
                    target: 'generating',
                },
                REGENERATE: {
                    target: 'generating',
                },
                RESET: {
                    target: 'idle',
                    actions: assign({ chatId: null, error: null }),
                }
            }
        },
        generating: {
            entry: 'clearError',
            invoke: {
                src: 'invokeBackend',
                input: ({ context, event }) => ({
                    context,
                    event,
                }),
                onDone: {
                    target: 'idle',
                },
                onError: {
                    target: 'idle', // We go back to idle but display error
                    actions: 'setError'
                }
            },
            on: {
                CANCEL: {
                    target: 'idle',
                },
                STREAM_COMPLETE: {
                    target: 'idle',
                },
                ERROR: {
                    target: 'idle',
                    actions: 'setError'
                }
            }
        }
    }
});
