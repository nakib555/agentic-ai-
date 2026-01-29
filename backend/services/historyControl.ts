
/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { promises as fs } from 'fs';
import path from 'path';
import { HISTORY_PATH, HISTORY_INDEX_PATH, TIME_GROUPS_PATH, readData, writeData } from '../data-store';
import type { ChatSession } from '../../src/types';

// Minimal metadata stored in the master index for fast listing
type ChatIndexEntry = {
    id: string;
    title: string;
    folderName: string;
    createdAt: number;
    updatedAt: number;
    model: string;
};

// Full conversation structure stored inside the chat folder
type ChatDataFile = ChatSession & {
    pagination?: {
        currentPage: number;
        totalPages: number;
        pageSize: number;
    };
    version: number;
};

// Simple Mutex for serializing async operations
class Mutex {
    private mutex = Promise.resolve();

    lock(): Promise<() => void> {
        let unlock: () => void = () => {};
        const nextLock = new Promise<void>(resolve => {
            unlock = resolve;
        });

        const willLock = this.mutex.then(() => unlock);
        this.mutex = this.mutex.then(() => nextLock);

        return willLock;
    }

    async dispatch<T>(fn: (() => T | PromiseLike<T>)): Promise<T> {
        const unlock = await this.lock();
        try {
            return await Promise.resolve(fn());
        } finally {
            unlock();
        }
    }
}

class HistoryControlService {
    private indexCache: ChatIndexEntry[] | null = null;
    private indexLock = new Mutex();

    // --- Index Management ---

    private async loadIndex(): Promise<ChatIndexEntry[]> {
        if (this.indexCache) return this.indexCache;
        try {
            this.indexCache = await readData(HISTORY_INDEX_PATH);
            return this.indexCache!;
        } catch (error: any) {
            // Only return empty if file strictly doesn't exist
            if (error.code === 'ENOENT') {
                return [];
            }
            
            console.error(`[HistoryControl] Critical Error: Failed to load history index.`, error);
            
            // If the file exists but is corrupt (SyntaxError) or unreadable, BACK IT UP before returning empty.
            // This prevents the app from silently wiping the user's history file on the next save.
            try {
                const backupPath = `${HISTORY_INDEX_PATH}.corrupt.${Date.now()}.bak`;
                await fs.copyFile(HISTORY_INDEX_PATH, backupPath);
                console.warn(`[HistoryControl] CORRUPT INDEX DETECTED. Backed up to: ${backupPath}`);
            } catch (backupError) {
                console.error(`[HistoryControl] Failed to backup corrupt index:`, backupError);
            }

            return [];
        }
    }

    private async saveIndex(index: ChatIndexEntry[]) {
        this.indexCache = index;
        
        // Check and ensure directory exists to prevent crash if folder is deleted manually
        try {
            await fs.mkdir(HISTORY_PATH, { recursive: true });
        } catch (error: any) {
            if (error.code !== 'EEXIST') console.error("Failed to ensure history directory:", error);
        }

        await writeData(HISTORY_INDEX_PATH, index);
        await this.updateTimeGroups(index);
    }

    private sanitizeTitle(title: string): string {
        // Improved to support Unicode characters for international titles
        // while maintaining filesystem safety.
        // Allows letters (unicode), numbers, spaces, dashes, underscores.
        return title
            .replace(/[^\p{L}\p{N}\s\-_]/gu, '') 
            .trim()
            .replace(/\s+/g, '-')      // Space to dash
            .replace(/-+/g, '-')       // Collapse dashes
            .substring(0, 64)          // Reasonable limit
            || 'Untitled';
    }

    private getFolderName(title: string, id: string): string {
        const safeTitle = this.sanitizeTitle(title);
        // Suffix with ID to ensure uniqueness and persistence even if titles collide
        return `${safeTitle}-${id.substring(0, 8)}`;
    }

    private async updateTimeGroups(index: ChatIndexEntry[]) {
        const groups: Record<string, ChatIndexEntry[]> = {
            'Today': [],
            'Yesterday': [],
            'Previous 7 Days': [],
            'Older': []
        };

        const now = new Date();
        const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
        const yesterdayStart = todayStart - 86400000;
        const weekStart = todayStart - (86400000 * 7);

        for (const entry of index) {
            if (entry.updatedAt >= todayStart) {
                groups['Today'].push(entry);
            } else if (entry.updatedAt >= yesterdayStart) {
                groups['Yesterday'].push(entry);
            } else if (entry.updatedAt >= weekStart) {
                groups['Previous 7 Days'].push(entry);
            } else {
                // Group older items by Month Year
                const date = new Date(entry.updatedAt);
                const monthYear = date.toLocaleString('default', { month: 'long', year: 'numeric' });
                if (!groups[monthYear]) groups[monthYear] = [];
                groups[monthYear].push(entry);
            }
        }
        
        // Remove empty default groups if not used (except maybe Today)
        if (groups['Older'].length === 0) delete groups['Older'];

        // Check and ensure directory exists
        try {
            await fs.mkdir(HISTORY_PATH, { recursive: true });
        } catch (error: any) {
             if (error.code !== 'EEXIST') console.error("Failed to ensure history directory:", error);
        }

        await writeData(TIME_GROUPS_PATH, groups);
    }

    // --- CRUD Operations ---

    async createChat(session: ChatSession): Promise<ChatSession> {
        // Use lock to prevent index race conditions
        return this.indexLock.dispatch(async () => {
            const folderName = this.getFolderName(session.title, session.id);
            const chatFolderPath = path.join(HISTORY_PATH, folderName);
            const chatSubDir = path.join(chatFolderPath, 'chat');
            const fileSubDir = path.join(chatFolderPath, 'file');

            // 1. Create Directory Structure
            await fs.mkdir(chatFolderPath, { recursive: true });
            await fs.mkdir(chatSubDir, { recursive: true });
            await fs.mkdir(fileSubDir, { recursive: true });

            // 2. Save Conversation Data (conversation.tsx inside chat/)
            const chatData: ChatDataFile = {
                ...session,
                version: 1,
                pagination: { currentPage: 1, totalPages: 1, pageSize: 100 }
            };
            await writeData(path.join(chatSubDir, 'conversation.tsx'), chatData);

            // 3. Update Index
            const index = await this.loadIndex();
            const entry: ChatIndexEntry = {
                id: session.id,
                title: session.title,
                folderName: folderName,
                createdAt: session.createdAt,
                updatedAt: Date.now(),
                model: session.model
            };
            index.unshift(entry); // Add to top
            await this.saveIndex(index);

            return session;
        });
    }

    async getChat(id: string): Promise<ChatSession | null> {
        // Read is safe without exclusive lock, but we access indexCache
        // which should be stable. For strictly consistent reads during writes,
        // we could lock, but it might kill perf. 
        // Given Node single-thread event loop, reading indexCache is atomic.
        // We only await loadIndex if cache is null.
        
        const index = await this.loadIndex();
        const entry = index.find(e => e.id === id);
        if (!entry) return null;

        const filePath = path.join(HISTORY_PATH, entry.folderName, 'chat', 'conversation.tsx');
        try {
            return await readData(filePath);
        } catch (error) {
            console.error(`[HistoryControl] Failed to read chat ${id}:`, error);
            return null;
        }
    }

    async updateChat(id: string, updates: Partial<ChatSession>): Promise<ChatSession | null> {
        return this.indexLock.dispatch(async () => {
            const index = await this.loadIndex();
            const entryIndex = index.findIndex(e => e.id === id);
            if (entryIndex === -1) return null;

            const entry = index[entryIndex];
            const originalFolderPath = path.join(HISTORY_PATH, entry.folderName);
            
            // Read current data (directly from file to get latest state)
            const filePath = path.join(HISTORY_PATH, entry.folderName, 'chat', 'conversation.tsx');
            let currentChat: ChatSession;
            try {
                currentChat = await readData(filePath);
            } catch (e) {
                return null;
            }

            const updatedChat: ChatDataFile = {
                ...currentChat,
                ...updates,
                version: 1 // Ensure version is preserved or incremented
            };
            let newFolderName = entry.folderName;

            // Handle Renaming (Title Change) - Rename the folder dynamically
            if (updates.title && updates.title !== entry.title) {
                newFolderName = this.getFolderName(updates.title, id);
                const newFolderPath = path.join(HISTORY_PATH, newFolderName);

                if (newFolderName !== entry.folderName) {
                    try {
                        // Check for collision
                        try {
                            await fs.access(newFolderPath);
                            // If exists (rare), keep old folder or append timestamp?
                            // Appending timestamp to ensure uniqueness
                            newFolderName = `${newFolderName}-${Date.now()}`;
                            // Re-calculate path
                            await fs.rename(originalFolderPath, path.join(HISTORY_PATH, newFolderName));
                        } catch {
                            // Destination does not exist, safe to rename
                            await fs.rename(originalFolderPath, newFolderPath);
                        }

                        entry.folderName = newFolderName;
                    } catch (error) {
                        console.error(`[HistoryControl] Failed to rename folder for chat ${id}:`, error);
                        // Fallback: keep old folder name if rename fails
                        newFolderName = entry.folderName; 
                    }
                }
                // Always update index title if requested
                entry.title = updates.title;
            }

            // Update File content in the (potentially new) location
            const chatSubDir = path.join(HISTORY_PATH, newFolderName, 'chat');
            
            try {
                // Ensure directory exists (in case of manual deletion or corruption)
                await fs.mkdir(chatSubDir, { recursive: true });
                
                await writeData(path.join(chatSubDir, 'conversation.tsx'), updatedChat);
            } catch (error) {
                console.error(`[HistoryControl] Failed to write conversation data for ${id}:`, error);
                throw error; // Propagate up so crudHandler can send 500
            }

            // Update Index metadata
            entry.updatedAt = Date.now();
            if (updates.model) entry.model = updates.model;
            
            // Move updated entry to top (Recency)
            index.splice(entryIndex, 1);
            index.unshift(entry);
            
            await this.saveIndex(index);
            return updatedChat;
        });
    }

    async deleteChat(id: string): Promise<void> {
        return this.indexLock.dispatch(async () => {
            const index = await this.loadIndex();
            const entryIndex = index.findIndex(e => e.id === id);
            if (entryIndex === -1) return;

            const entry = index[entryIndex];
            const folderPath = path.join(HISTORY_PATH, entry.folderName);

            try {
                await fs.rm(folderPath, { recursive: true, force: true });
            } catch (error) {
                console.error(`[HistoryControl] Failed to delete folder ${folderPath}:`, error);
            }

            index.splice(entryIndex, 1);
            await this.saveIndex(index);
        });
    }

    async deleteAllChats(): Promise<void> {
        return this.indexLock.dispatch(async () => {
            // 1. Clear In-Memory Cache
            this.indexCache = [];

            // 2. Physically Wipe the History Directory
            try {
                // Check if directory exists first
                try {
                    await fs.access(HISTORY_PATH);
                } catch {
                    // Directory doesn't exist, nothing to delete.
                    // Re-initialize empty index and return.
                    await this.saveIndex([]);
                    return;
                }

                const entries = await fs.readdir(HISTORY_PATH);
                for (const entry of entries) {
                    const fullPath = path.join(HISTORY_PATH, entry);
                    // Forcefully remove everything in the history path
                    await fs.rm(fullPath, { recursive: true, force: true });
                }
            } catch (error) {
                console.error("[HistoryControl] Failed to wipe history directory:", error);
                throw error;
            }

            // 3. Re-initialize empty Index and TimeGroups files
            await this.saveIndex([]);
        });
    }

    async getHistoryList(): Promise<Omit<ChatSession, 'messages'>[]> {
        const index = await this.loadIndex();
        // Return the cached index list. 
        // CRITICAL: We explicitly set messages to undefined so the frontend knows 
        // this is a summary and needs to fetch full details.
        return index.map(e => ({
            id: e.id,
            title: e.title,
            createdAt: e.createdAt,
            model: e.model,
            messages: undefined as any // Type cast to satisfy TS but send "undefined" in logic (JSON.stringify will omit it)
        }));
    }

    // --- Public Path Resolvers for other services ---
    
    async getChatFolderPath(id: string): Promise<string | null> {
        const index = await this.loadIndex();
        const entry = index.find(e => e.id === id);
        if (!entry) return null;
        return path.join(HISTORY_PATH, entry.folderName);
    }
    
    async getPublicUrlBase(id: string): Promise<string | null> {
        const index = await this.loadIndex();
        const entry = index.find(e => e.id === id);
        if (!entry) return null;
        // Returns the URL segment for the frontend to access files
        return `/uploads/${entry.folderName}/file`;
    }

    // --- Truncation Logic for Regeneration ---
    async truncateChatHistory(chatId: string, messageId: string): Promise<ChatSession | null> {
        const chat = await this.getChat(chatId);
        if (!chat) return null;

        const messageIndex = chat.messages.findIndex(m => m.id === messageId);
        // If message not found, or it's the very first message, handled by caller or no-op
        if (messageIndex === -1) return chat;

        // Keep messages BEFORE this index
        // This removes the target AI message and anything after it.
        // It keeps the User message that triggered it if the AI message is at index > 0
        const truncatedMessages = chat.messages.slice(0, messageIndex);
        
        // We update the chat with truncated messages
        return await this.updateChat(chatId, { messages: truncatedMessages });
    }
}

export const historyControl = new HistoryControlService();
