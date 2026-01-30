
/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { historyControl } from './services/historyControl';
import type { ChatSession } from '../src/types';
import { v4 as uuidv4 } from 'uuid';

const generateId = () => uuidv4();

export const getHistory = async (req: any, res: any) => {
    try {
        const history = await historyControl.getHistoryList();
        res.status(200).json(history);
    } catch (error) {
        console.error('Failed to get chat history:', error);
        res.status(500).json({ error: 'Failed to retrieve chat history from the server.' });
    }
};

export const getChat = async (req: any, res: any) => {
    try {
        const chat = await historyControl.getChat(req.params.chatId);
        if (chat) {
            res.status(200).json(chat);
        } else {
            res.status(404).json({ error: 'Chat not found' });
        }
    } catch (error: any) {
        console.error(`[CRUD] Failed to get chat ${req.params.chatId}:`, error);
        res.status(500).json({ error: "Internal server error reading chat." });
    }
};

export const createNewChat = async (req: any, res: any) => {
    try {
        // Accept optional 'id' from client for optimistic updates
        const { id, model, temperature, maxOutputTokens, imageModel, videoModel } = req.body;
        const newChatId = id || generateId();
        const newChat: ChatSession = {
            id: newChatId,
            title: "New Chat",
            messages: [],
            model: model,
            isLoading: false,
            createdAt: Date.now(),
            temperature,
            maxOutputTokens,
            imageModel: imageModel,
            videoModel: videoModel,
        };
        
        await historyControl.createChat(newChat);
        res.status(201).json(newChat);
    } catch (error) {
        console.error("Failed to create chat:", error);
        res.status(500).json({ error: "Failed to create chat session." });
    }
};

export const updateChat = async (req: any, res: any) => {
    try {
        const { chatId } = req.params;
        const updates = req.body;
        
        // historyControl.updateChat handles title renaming and index updating automatically
        const updatedChat = await historyControl.updateChat(chatId, updates);
        
        if (!updatedChat) {
            // If chat doesn't exist in index (e.g. manual deletion or sync issue), attempt to recreate it.
             console.warn(`[CRUD] updateChat called for non-existent chatId "${chatId}". Creating new session.`);
             const recoveredChat: ChatSession = {
                id: chatId,
                title: updates.title || "New Chat",
                messages: updates.messages || [],
                model: updates.model || '',
                createdAt: Date.now(),
                ...updates
            };
            await historyControl.createChat(recoveredChat);
            res.status(200).json(recoveredChat);
            return;
        }

        res.status(200).json(updatedChat);
    } catch (error: any) {
        console.error(`[CRUD] Failed to update chat ${req.params.chatId}:`, error);
        res.status(500).json({ error: "Failed to update chat session.", details: error.message });
    }
};

export const deleteChat = async (req: any, res: any) => {
    try {
        await historyControl.deleteChat(req.params.chatId);
        res.status(204).send();
    } catch (error: any) {
        console.error(`[CRUD] Failed to delete chat ${req.params.chatId}:`, error);
        res.status(500).json({ error: "Failed to delete chat." });
    }
};

export const deleteAllHistory = async (req: any, res: any) => {
    try {
        await historyControl.deleteAllChats();
        res.status(204).send();
    } catch (error) {
        console.error("Failed to delete all history:", error);
        res.status(500).json({ error: "Failed to delete all data." });
    }
};

export const importChat = async (req: any, res: any) => {
    try {
        const payload = req.body;
        const createdChats: ChatSession[] = [];

        // Helper to process and validate a single chat object
        const processSingleChat = async (data: any) => {
            if (!data || typeof data !== 'object') return null;

            // Basic structural check
            if (!Array.isArray(data.messages)) {
                console.warn("[Import] Skipping item with missing messages array.");
                return null;
            }
            
            // Deep check a few messages to ensure structure if possible
            // We'll be lenient to allow partial data imports
            
            const newChat: ChatSession = {
                ...data,
                id: generateId(), // Always regenerate ID to avoid collision
                title: typeof data.title === 'string' ? data.title : "Imported Chat",
                createdAt: typeof data.createdAt === 'number' ? data.createdAt : Date.now(),
                isLoading: false,
            };
            
            await historyControl.createChat(newChat);
            return newChat;
        };

        if (Array.isArray(payload)) {
            // Bulk Import
            for (const item of payload) {
                const imported = await processSingleChat(item);
                if (imported) createdChats.push(imported);
            }
        } else {
            // Single Import
            const imported = await processSingleChat(payload);
            if (imported) {
                createdChats.push(imported);
            } else {
                 return res.status(400).json({ error: "Invalid chat format. Expected a chat object or an array of chats." });
            }
        }

        res.status(201).json(createdChats);
    } catch (error) {
        console.error("Failed to import chat:", error);
        res.status(500).json({ error: "Failed to import chat." });
    }
};
