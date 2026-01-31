/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import type { Message } from '../../types';
import { fetchFromApi } from '../../utils/api';

export const generateChatTitle = async (messages: Message[], model?: string): Promise<string> => {
    try {
        // Optimization: Only send the first 5 messages to the backend for title generation.
        // This reduces payload size significantly for long chats while keeping relevant context.
        const contextMessages = messages.slice(0, 5).map(m => ({
            role: m.role,
            // Truncate text content to further save bandwidth
            text: m.text ? m.text.substring(0, 500) : '' 
        }));

        const response = await fetchFromApi('/api/handler?task=title', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ messages: contextMessages, model }),
            silent: true // Suppress errors for background tasks
        });

        if (!response.ok) {
            const errorText = await response.text();
            throw new Error(`Title generation failed with status ${response.status}: ${errorText}`);
        }

        const { title } = await response.json();
        
        if (title) {
            return title;
        }
    } catch (error) {
        // A non-critical background task failed (e.g., API overload).
        // We warn instead of erroring to avoid red console noise for the user.
        if ((error as Error).message !== 'Version mismatch') {
            // console.warn("Title generation API call failed:", error);
        }
    }
    
    // Fallback if API call fails or returns an empty title
    const firstUserMessage = messages.find(m => m.role === 'user')?.text.substring(0, 45) || 'Untitled Chat';
    return firstUserMessage;
};