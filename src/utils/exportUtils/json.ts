/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

// PART 1 of 3 from src/utils/exportUtils.ts
// Contains logic for JSON export.

import type { ChatSession } from '../../types';

const sanitizeFilename = (title: string): string => {
  return title.replace(/[^a-z0-9-_]/gi, '_').substring(0, 50) || 'chat';
};

const formatChatForExport = (chat: ChatSession) => {
    return {
        title: chat.title,
        model: chat.model,
        exportedOn: new Date().toISOString(),
        messages: chat.messages.filter(m => !m.isHidden).map(m => {
            const base = {
                role: m.role
            };
            
            if (m.role === 'user') {
                return {
                    ...base,
                    text: m.text,
                    attachments: m.attachments?.map(a => a.name) || []
                };
            } else {
                const activeResponse = m.responses?.[m.activeResponseIndex];
                return {
                    ...base,
                    responseIndex: m.activeResponseIndex + 1,
                    totalResponses: m.responses?.length || 1,
                    text: activeResponse?.text || '',
                    error: activeResponse?.error?.message || null
                };
            }
        })
    };
};

export const exportChatToJson = (chat: ChatSession) => {
    const formattedData = formatChatForExport(chat);
    const jsonContent = JSON.stringify(formattedData, null, 2);
    const blob = new Blob([jsonContent], { type: 'application/json;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${sanitizeFilename(chat.title)}.json`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
};

export const exportAllChatsToJson = (chats: ChatSession[]) => {
    const formattedData = chats.map(formatChatForExport);
    const jsonContent = JSON.stringify(formattedData, null, 2);
    const blob = new Blob([jsonContent], { type: 'application/json;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    const date = new Date().toISOString().slice(0, 10);
    link.download = `agentic-ai-history-${date}.json`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
};
