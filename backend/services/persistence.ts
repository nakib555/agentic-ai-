import { historyControl } from './historyControl';

export class ChatPersistenceManager {
    private chatId: string;
    private messageId: string;
    private buffer: { text: string } | null = null;
    private saveTimeout: ReturnType<typeof setTimeout> | null = null;
    private readonly FLUSH_DELAY_MS = 200; 

    constructor(chatId: string, messageId: string) {
        this.chatId = chatId;
        this.messageId = messageId;
    }

    addText(delta: string) {
        if (!this.buffer) this.buffer = { text: '' };
        this.buffer.text += delta;
        this.scheduleSave();
    }

    async update(modifier: (response: any) => void) {
        if (this.saveTimeout) {
            clearTimeout(this.saveTimeout);
            this.saveTimeout = null;
        }
        try {
            const chat = await historyControl.getChat(this.chatId);
            if (!chat) return;
            const msgIndex = chat.messages.findIndex((m: any) => m.id === this.messageId);
            if (msgIndex !== -1) {
                const message = chat.messages[msgIndex];
                if (message.responses && message.responses[message.activeResponseIndex]) {
                    const activeResponse = message.responses[message.activeResponseIndex];
                    if (this.buffer) {
                        activeResponse.text = (activeResponse.text || '') + this.buffer.text;
                        this.buffer = null;
                    }
                    modifier(activeResponse);
                    await historyControl.updateChat(this.chatId, { messages: chat.messages });
                }
            }
        } catch (e) {
            console.error(`[PERSISTENCE] Failed to update chat ${this.chatId}:`, e);
        }
    }

    private scheduleSave() {
        if (this.saveTimeout) return;
        this.saveTimeout = setTimeout(() => this.flush(), this.FLUSH_DELAY_MS); 
    }

    private async flush() {
        this.saveTimeout = null;
        if (!this.buffer) return;
        const textToAppend = this.buffer.text;
        this.buffer = null; 
        try {
            const chat = await historyControl.getChat(this.chatId);
            if (!chat) return;
            const msgIndex = chat.messages.findIndex((m: any) => m.id === this.messageId);
            if (msgIndex !== -1) {
                const message = chat.messages[msgIndex];
                if (message.responses && message.responses[message.activeResponseIndex]) {
                    const activeResponse = message.responses[message.activeResponseIndex];
                    activeResponse.text = (activeResponse.text || '') + textToAppend;
                    await historyControl.updateChat(this.chatId, { messages: chat.messages });
                }
            }
        } catch (e) { }
    }

    async complete(finalModifier?: (response: any) => void) {
        if (this.saveTimeout) clearTimeout(this.saveTimeout);
        try {
            const chat = await historyControl.getChat(this.chatId);
            if (!chat) return;
            const msgIndex = chat.messages.findIndex((m: any) => m.id === this.messageId);
            if (msgIndex !== -1) {
                const message = chat.messages[msgIndex];
                if (message.responses && message.responses[message.activeResponseIndex]) {
                    const activeResponse = message.responses[message.activeResponseIndex];
                    if (this.buffer) {
                        activeResponse.text = (activeResponse.text || '') + this.buffer.text;
                        this.buffer = null;
                    }
                    if (finalModifier) finalModifier(activeResponse);
                    message.isThinking = false;
                    await historyControl.updateChat(this.chatId, { messages: chat.messages });
                }
            }
        } catch (e) {
            console.error(`[PERSISTENCE] Failed to complete save for chat ${this.chatId}:`, e);
        }
    }
}
