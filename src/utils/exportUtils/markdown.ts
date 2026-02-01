
/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import type { ChatSession } from '../../types';
import { parseMessageText } from '../messageParser';

const sanitizeFilename = (title: string): string => {
  return title.replace(/[^a-z0-9-_]/gi, '_').substring(0, 50) || 'chat';
};

const getChatAsMarkdown = (chat: ChatSession): string => {
    let markdownContent = `# Chat: ${chat.title}\n\n`;
    markdownContent += `**Model:** ${chat.model}\n`;
    markdownContent += `**Exported on:** ${new Date().toLocaleString()}\n\n---\n\n`;

    for (const message of chat.messages) {
        if (message.isHidden) continue;

        if (message.role === 'user') {
            markdownContent += `**You:**\n`;
            if (message.attachments && message.attachments.length > 0) {
                markdownContent += `*Attached ${message.attachments.length} file(s): ${message.attachments.map(a => a.name).join(', ')}*\n\n`;
            }
            markdownContent += `${message.text}\n\n`;
        } else if (message.role === 'model') {
            markdownContent += `**AI (Response ${message.activeResponseIndex + 1} of ${message.responses?.length || 1}):**\n`;
            
            const activeResponse = message.responses?.[message.activeResponseIndex];
            if (!activeResponse) continue;

            const { thinkingText, finalAnswerText } = parseMessageText(activeResponse.text, false, !!activeResponse.error);

            if (thinkingText) {
                markdownContent += `<details>\n<summary>View thought process</summary>\n\n\`\`\`\n${thinkingText.trim()}\n\`\`\`\n</details>\n\n`;
            }

            let answer = finalAnswerText.replace(/\[(IMAGE|VIDEO|MAP|FILE_ATTACHMENT|MCQ)_COMPONENT\].*?\[\/\1_COMPONENT\]/gs, (match, type) => {
                const placeholder = type.toLowerCase().replace('_', ' ');
                return `\n*[${placeholder} presented]*\n`;
            });

            // Handle XML components in export
            answer = answer.replace(/<map>.*?<\/map>/gs, '\n*[Map displayed]*\n');
            answer = answer.replace(/<echarts>.*?<\/echarts>/gs, '\n*[Chart displayed]*\n');

            if (answer) markdownContent += `${answer}\n\n`;
            if (activeResponse.error) markdownContent += `**Error:** ${activeResponse.error.message}\n\n`;
        }
    }
    return markdownContent;
};

export const exportChatToMarkdown = (chat: ChatSession) => {
  const markdownContent = getChatAsMarkdown(chat);
  const blob = new Blob([markdownContent], { type: 'text/markdown;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `${sanitizeFilename(chat.title)}.md`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
};

export const exportChatToClipboard = (chat: ChatSession) => {
    const markdownContent = getChatAsMarkdown(chat);
    navigator.clipboard.writeText(markdownContent).then(() => {
        alert('Chat content copied to clipboard as Markdown!');
    }, (err) => {
        console.error('Failed to copy chat to clipboard: ', err);
        alert('Could not copy chat to clipboard.');
    });
};
