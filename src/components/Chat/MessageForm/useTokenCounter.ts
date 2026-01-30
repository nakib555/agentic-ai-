
/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState, useEffect, useRef } from 'react';
import { fetchFromApi } from '../../../utils/api';
import type { ProcessedFile } from './types';

// Debounce interval to prevent API flooding
const DEBOUNCE_MS = 800;

export const useTokenCounter = (
    inputValue: string,
    files: ProcessedFile[],
    isAgentMode: boolean,
    model: string,
    chatId: string | null,
    hasApiKey: boolean,
    historyTrigger: string | number
) => {
    const [tokenCount, setTokenCount] = useState<number | null>(null);
    const [isCounting, setIsCounting] = useState(false);
    const timeoutRef = useRef<number | null>(null);
    const latestRequestRef = useRef<number>(0);

    const formatCount = (count: number): string => {
        if (count < 1000) return count.toString();
        if (count < 1000000) return (count / 1000).toFixed(2) + 'k';
        return (count / 1000000).toFixed(2) + 'm';
    };

    useEffect(() => {
        if (!hasApiKey) {
            setTokenCount(null);
            return;
        }

        // Only count if there is input or files, or if there's history (chatId exists)
        // If it's a new empty chat, the system prompt still costs tokens, so we should count.
        
        if (timeoutRef.current) {
            window.clearTimeout(timeoutRef.current);
        }

        setIsCounting(true);

        timeoutRef.current = window.setTimeout(async () => {
            const requestId = Date.now();
            latestRequestRef.current = requestId;

            try {
                // Prepare message payload similar to sending a message
                // We only need basic file data for counting (mime + base64)
                const attachments = files
                    .filter(f => f.base64Data && !f.error)
                    .map(f => ({ 
                        mimeType: f.file.type, 
                        data: f.base64Data 
                    }));

                const newMessage = (inputValue.trim() || attachments.length > 0) 
                    ? { text: inputValue, attachments } 
                    : null;

                const response = await fetchFromApi('/api/handler?task=count_tokens', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        chatId,
                        model,
                        isAgentMode: false,
                        newMessage
                    }),
                    silent: true // Suppress errors for background tasks
                });

                if (requestId !== latestRequestRef.current) return; // Ignore stale requests

                if (response.ok) {
                    const data = await response.json();
                    setTokenCount(data.totalTokens);
                } else {
                    // Fail silently for token counting
                    // console.warn('[TokenCounter] Failed to fetch token count');
                }
            } catch (error) {
                // console.error('[TokenCounter] Error:', error);
            } finally {
                if (requestId === latestRequestRef.current) {
                    setIsCounting(false);
                }
            }
        }, DEBOUNCE_MS);

        return () => {
            if (timeoutRef.current) window.clearTimeout(timeoutRef.current);
        };
    }, [inputValue, files, isAgentMode, model, chatId, hasApiKey, historyTrigger]);

    return {
        formattedCount: tokenCount !== null ? formatCount(tokenCount) : null,
        rawCount: tokenCount,
        isCounting
    };
};
