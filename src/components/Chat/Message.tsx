
/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { memo } from 'react';
import type { Message, Source } from '../../types';
import { UserMessage } from './UserMessage';
import { AiMessage } from './AiMessage/index';
import type { MessageFormHandle } from './MessageForm/index';

const MessageComponentRaw: React.FC<{ 
    msg: Message;
    isLoading: boolean;
    isLast?: boolean; // New prop to determine if this is the active message
    sendMessage: (message: string, files?: File[], options?: { isHidden?: boolean; isThinkingModeEnabled?: boolean; }) => void; 
    ttsVoice: string; 
    ttsModel: string;
    currentChatId: string | null;
    activeModel: string;
    provider?: string;
    onShowSources: (sources: Source[]) => void;
    messageFormRef: React.RefObject<MessageFormHandle>;
    onRegenerate: (messageId: string) => void;
    onSetActiveResponseIndex: (messageId: string, index: number) => void;
    userQuery?: string;
    onEditMessage?: (messageId: string, newText: string) => void;
    onNavigateBranch?: (messageId: string, direction: 'next' | 'prev') => void;
}> = ({ 
    msg, isLoading, isLast, sendMessage, ttsVoice, ttsModel, currentChatId, activeModel, provider,
    onShowSources, messageFormRef,
    onRegenerate, onSetActiveResponseIndex, userQuery,
    onEditMessage, onNavigateBranch
}) => {
  const messageContent = () => {
    if (msg.role === 'user') {
        return (
            <UserMessage 
                msg={msg} 
                onEdit={onEditMessage ? (newText) => onEditMessage(msg.id, newText) : undefined} 
                onBranchSwitch={onNavigateBranch ? (dir) => onNavigateBranch(msg.id, dir) : undefined}
            />
        );
    }
    
    if (msg.role === 'model') {
        return (
            <AiMessage 
                msg={msg} 
                isLoading={isLoading}
                sendMessage={sendMessage} 
                ttsVoice={ttsVoice}
                ttsModel={ttsModel} 
                currentChatId={currentChatId} 
                activeModel={activeModel}
                provider={provider}
                onShowSources={onShowSources}
                messageFormRef={messageFormRef}
                onRegenerate={onRegenerate}
                onSetActiveResponseIndex={onSetActiveResponseIndex}
                userQuery={userQuery}
                isLast={isLast}
            />
        );
    }
    return null;
  };

  return (
    <div id={`message-${msg.id}`} className="contain-content">
        {messageContent()}
    </div>
  );
};

export const MessageComponent = memo(MessageComponentRaw, (prevProps, nextProps) => {
    const prevMsg = prevProps.msg;
    const nextMsg = nextProps.msg;

    // Retrieve the specific response objects being displayed
    const prevActiveResponse = prevMsg.responses?.[prevMsg.activeResponseIndex];
    const nextActiveResponse = nextMsg.responses?.[nextMsg.activeResponseIndex];

    const msgChanged = 
        prevMsg.text !== nextMsg.text ||
        prevMsg.isThinking !== nextMsg.isThinking ||
        prevMsg.activeResponseIndex !== nextMsg.activeResponseIndex ||
        prevMsg.activeVersionIndex !== nextMsg.activeVersionIndex ||
        prevMsg.responses?.length !== nextMsg.responses?.length ||
        prevMsg.versions?.length !== nextMsg.versions?.length ||
        prevMsg.executionState !== nextMsg.executionState ||
        prevActiveResponse !== nextActiveResponse;

    // Check if userQuery changed (rare)
    if (prevProps.userQuery !== nextProps.userQuery) return false;
    
    // Check TTS settings changes
    if (prevProps.ttsVoice !== nextProps.ttsVoice || prevProps.ttsModel !== nextProps.ttsModel) return false;
    
    // Check isLast change (needed for suggestions visibility)
    if (prevProps.isLast !== nextProps.isLast) return false;
    
    // Check model/provider changes
    if (prevProps.activeModel !== nextProps.activeModel || prevProps.provider !== nextProps.provider) return false;

    // CRITICAL OPTIMIZATION: 
    // If the message itself hasn't changed, ignore `isLoading` changes UNLESS this is the last message.
    // Historical messages shouldn't re-render just because the *global* app state is loading.
    // The `isLast` prop ensures the active generation UI updates correctly.
    if (!msgChanged) {
        if (prevProps.isLast || nextProps.isLast) {
            // If it is (or was) the last message, respect isLoading changes
            return prevProps.isLoading === nextProps.isLoading;
        }
        // Historical messages: ignore isLoading changes
        return true; 
    }

    return false; // Re-render if message changed
});
