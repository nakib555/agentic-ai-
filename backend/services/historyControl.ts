/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import db from '../db';
import path from 'path';
import { HISTORY_PATH } from '../constants';
import type { ChatSession, Message } from '../../src/types';

class HistoryControlService {
    
    // --- CRUD Operations ---

    async createChat(session: ChatSession): Promise<ChatSession> {
        try {
            const insertChat = db.prepare(`
                INSERT INTO chats (id, title, createdAt, updatedAt, model)
                VALUES (?, ?, ?, ?, ?)
            `);
            
            const insertMessage = db.prepare(`
                INSERT INTO messages (id, chatId, role, content, createdAt)
                VALUES (?, ?, ?, ?, ?)
            `);

            const transaction = db.transaction(() => {
                insertChat.run(
                    session.id,
                    session.title,
                    session.createdAt,
                    Date.now(),
                    session.model || null
                );

                for (const msg of session.messages) {
                    insertMessage.run(
                        msg.id,
                        session.id,
                        msg.role,
                        JSON.stringify(msg),
                        Date.now()
                    );
                }
            });

            transaction();
            return session;
        } catch (error) {
            console.error("[HistoryControl] Failed to create chat:", error);
            throw error;
        }
    }

    async getChat(id: string): Promise<ChatSession | null> {
        try {
            const chat = db.prepare('SELECT * FROM chats WHERE id = ?').get(id) as any;
            if (!chat) return null;

            const messages = db.prepare('SELECT * FROM messages WHERE chatId = ? ORDER BY createdAt ASC').all(id) as any[];

            const parsedMessages: Message[] = messages.map(dbMsg => {
                try {
                    const parsed = JSON.parse(dbMsg.content);
                    return { ...parsed, id: dbMsg.id };
                } catch (e) {
                    console.error(`[HistoryControl] Failed to parse message content for ${dbMsg.id}`, e);
                    return null;
                }
            }).filter((m): m is Message => m !== null);

            return {
                id: chat.id,
                title: chat.title,
                messages: parsedMessages,
                model: chat.model || undefined,
                createdAt: chat.createdAt,
                isLoading: false,
            };
        } catch (error) {
            console.error(`[HistoryControl] Failed to get chat ${id}:`, error);
            return null;
        }
    }

    async updateChat(id: string, updates: Partial<ChatSession>): Promise<ChatSession | null> {
        try {
            const transaction = db.transaction(() => {
                // 1. Update Chat Metadata
                const sets: string[] = ['updatedAt = ?'];
                const args: any[] = [Date.now()];

                if (updates.title) {
                    sets.push('title = ?');
                    args.push(updates.title);
                }
                if (updates.model) {
                    sets.push('model = ?');
                    args.push(updates.model);
                }
                
                args.push(id); // For WHERE clause

                db.prepare(`UPDATE chats SET ${sets.join(', ')} WHERE id = ?`).run(...args);

                // 2. Handle Messages Update (Full Replacement)
                if (updates.messages) {
                    db.prepare('DELETE FROM messages WHERE chatId = ?').run(id);
                    
                    const insertMessage = db.prepare(`
                        INSERT INTO messages (id, chatId, role, content, createdAt)
                        VALUES (?, ?, ?, ?, ?)
                    `);

                    for (const msg of updates.messages) {
                        insertMessage.run(
                            msg.id,
                            id,
                            msg.role,
                            JSON.stringify(msg),
                            Date.now()
                        );
                    }
                }
            });

            transaction();
            return await this.getChat(id);

        } catch (error) {
            console.error(`[HistoryControl] Failed to update chat ${id}:`, error);
            return null;
        }
    }

    async deleteChat(id: string): Promise<void> {
        try {
            db.prepare('DELETE FROM chats WHERE id = ?').run(id);
        } catch (error) {
            console.error(`[HistoryControl] Failed to delete chat ${id}:`, error);
        }
    }

    async deleteAllChats(): Promise<void> {
        try {
            db.prepare('DELETE FROM chats').run();
        } catch (error) {
            console.error("[HistoryControl] Failed to delete all chats:", error);
            throw error;
        }
    }

    async getHistoryList(): Promise<Omit<ChatSession, 'messages'>[]> {
        try {
            const chats = db.prepare('SELECT id, title, createdAt, updatedAt, model FROM chats ORDER BY updatedAt DESC').all() as any[];

            return chats.map(chat => ({
                id: chat.id,
                title: chat.title,
                createdAt: chat.createdAt,
                updatedAt: chat.updatedAt,
                model: chat.model || undefined,
                messages: undefined as any
            }));
        } catch (error) {
            console.error("[HistoryControl] Failed to get history list:", error);
            return [];
        }
    }

    // --- Public Path Resolvers ---
    
    async getChatFolderPath(id: string): Promise<string | null> {
        // In DB mode, we use the ID as the folder name for any file attachments
        return path.join(HISTORY_PATH, id);
    }
    
    async getPublicUrlBase(id: string): Promise<string | null> {
        // Returns the URL segment for the frontend to access files
        // We map /uploads/{id}/file to the physical path
        return `/uploads/${id}/file`;
    }

    // --- Truncation Logic ---
    async truncateChatHistory(chatId: string, messageId: string): Promise<ChatSession | null> {
        const chat = await this.getChat(chatId);
        if (!chat) return null;

        const messageIndex = chat.messages.findIndex(m => m.id === messageId);
        if (messageIndex === -1) return chat;

        const truncatedMessages = chat.messages.slice(0, messageIndex);
        
        return await this.updateChat(chatId, { messages: truncatedMessages });
    }
}

export const historyControl = new HistoryControlService();
