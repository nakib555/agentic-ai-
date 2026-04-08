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

export const exportChatToJson = (chat: ChatSession) => {
    const jsonContent = JSON.stringify(chat, null, 2);
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
    const jsonContent = JSON.stringify(chats, null, 2);
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
