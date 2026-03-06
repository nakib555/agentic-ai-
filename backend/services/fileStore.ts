/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { promises as fs } from 'fs';
import path from 'path';
import { Buffer } from 'buffer';
import { ToolError } from '../utils/apiError';
import { historyControl } from './historyControl';
import { writeFileAtomic } from '../data-store';

const ensureDir = async (dirPath: string) => {
    try {
        await fs.mkdir(dirPath, { recursive: true });
    } catch (error: any) {
        if (error.code !== 'EEXIST') {
            console.error(`Error creating directory ${dirPath}:`, error);
        }
    }
};

// Helper to resolve path using HistoryControl
// This ensures we are always looking inside data/history/{Title-ID}/file/
const resolveChatFilePath = async (chatId: string, virtualPath: string): Promise<string> => {
    const chatFolder = await historyControl.getChatFolderPath(chatId);
    if (!chatFolder) {
        throw new ToolError('fileStore', 'CHAT_NOT_FOUND', `Chat session ${chatId} does not exist.`);
    }
    
    const fileDir = path.join(chatFolder, 'file');
    
    // Sanitize virtual path to prevent traversal
    const safeVirtualPath = path.normalize(virtualPath).replace(/^(\.\.(\/|\\|$))+/, '');
    const finalPath = path.join(fileDir, safeVirtualPath);

    if (!finalPath.startsWith(fileDir)) {
        throw new ToolError('fileStore', 'PATH_TRAVERSAL', 'Access denied: Path is outside the allowed directory.');
    }
    
    return finalPath;
};

export const fileStore = {
    async saveFile(chatId: string, virtualPath: string, data: Buffer | string): Promise<void> {
        const realPath = await resolveChatFilePath(chatId, virtualPath);
        
        // Use atomic write to prevent partial file creation
        await writeFileAtomic(realPath, data);
        
        console.log(`[FileStore] Saved file for chat ${chatId} to: ${realPath}`);
    },

    async getFile(chatId: string, virtualPath: string): Promise<Buffer | null> {
        try {
            const realPath = await resolveChatFilePath(chatId, virtualPath);
            return await fs.readFile(realPath);
        } catch (error: any) {
            if (error.code === 'ENOENT') return null;
            throw error;
        }
    },

    async listFiles(chatId: string, virtualPath: string): Promise<string[]> {
        try {
            const realPath = await resolveChatFilePath(chatId, virtualPath);
            // Check if directory exists before reading
            try {
                await fs.access(realPath);
            } catch {
                return [];
            }
            
            const entries = await fs.readdir(realPath, { withFileTypes: true });
            
            // Sort files alphabetically for consistent output
            entries.sort((a, b) => a.name.localeCompare(b.name));

            return entries.map(entry => entry.name + (entry.isDirectory() ? '/' : ''));
        } catch (error: any) {
            if (error.code === 'ENOENT') return [];
            throw error;
        }
    },

    async deleteFile(chatId: string, virtualPath: string): Promise<void> {
        try {
            const realPath = await resolveChatFilePath(chatId, virtualPath);
            await fs.unlink(realPath);
        } catch (error: any) {
            if (error.code !== 'ENOENT') throw error;
        }
    },
    
    async getPublicUrl(chatId: string, virtualPath: string): Promise<string> {
        const baseUrl = await historyControl.getPublicUrlBase(chatId);
        if (!baseUrl) {
             throw new ToolError('fileStore', 'CHAT_NOT_FOUND', `Chat session ${chatId} does not exist.`);
        }
        const normalized = path.normalize(virtualPath).replace(/\\/g, '/');
        return `${baseUrl}/${normalized}`;
    }
};