
/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { Message, ModelResponse } from '../../types';

/**
 * Helper to deep clone messages to prevent mutation of the readonly source state.
 * Uses structuredClone if available for better performance and type fidelity.
 */
const deepClone = <T>(obj: T): T => {
    if (typeof structuredClone === 'function') {
        return structuredClone(obj);
    }
    return JSON.parse(JSON.stringify(obj));
};

/**
 * Creates a new version branch for a user message.
 * It effectively "forks" the conversation at this point by creating a new version entry
 * and saving the "future" messages of the current branch into the payload of the *previous* version.
 */
export const createBranchForUserMessage = (
    messages: Message[],
    messageId: string,
    newText: string
): { updatedMessages: Message[], targetMessage: Message, futureMessages: Message[] } | null => {
    
    const messageIndex = messages.findIndex(m => m.id === messageId);
    if (messageIndex === -1) return null;

    // Clone to avoid mutation
    const updatedMessages = deepClone(messages);
    const targetMessage = updatedMessages[messageIndex];
    
    // The "future" is everything after this message in the current timeline
    const futureMessages = updatedMessages.slice(messageIndex + 1);
    
    const currentVersionIndex = targetMessage.activeVersionIndex ?? 0;

    // Initialize versions array if legacy message
    if (!targetMessage.versions || targetMessage.versions.length === 0) {
        targetMessage.versions = [{
            text: targetMessage.text,
            attachments: targetMessage.attachments,
            createdAt: Date.now(),
            historyPayload: futureMessages
        }];
        targetMessage.activeVersionIndex = 0;
    } else {
        // Save the future of the current branch into the current version
        if (targetMessage.versions[currentVersionIndex]) {
            targetMessage.versions[currentVersionIndex].historyPayload = futureMessages;
        }
    }

    // Create the new version
    const newVersionIndex = targetMessage.versions.length;
    targetMessage.versions.push({
        text: newText,
        attachments: targetMessage.attachments, // Inherit attachments
        createdAt: Date.now(),
        historyPayload: [] // New branch has no future yet
    });

    targetMessage.activeVersionIndex = newVersionIndex;
    targetMessage.text = newText; // Update main text property for easy access

    // Truncate the main list to just this message (future is cleared for the new branch)
    const truncatedList = [...updatedMessages.slice(0, messageIndex), targetMessage];

    return { updatedMessages: truncatedList, targetMessage, futureMessages: [] };
};

/**
 * Creates a new response branch for an AI message (Regeneration).
 * It preserves the current response and its future context, then creates a fresh slot.
 */
export const createBranchForModelResponse = (
    messages: Message[],
    aiMessageId: string
): { updatedMessages: Message[], targetMessage: Message } | null => {

    const messageIndex = messages.findIndex(m => m.id === aiMessageId);
    // Can't regenerate if it's not an AI message or if it's the very first message (unlikely)
    if (messageIndex < 1 || messages[messageIndex-1].role !== 'user') return null;

    const updatedMessages = deepClone(messages);
    const targetMessage = updatedMessages[messageIndex];
    
    // The "future" relative to this AI response
    const futureMessages = updatedMessages.slice(messageIndex + 1);

    // Initialize responses if legacy or empty
    if (!targetMessage.responses || targetMessage.responses.length === 0) {
        targetMessage.responses = [{
            text: targetMessage.text,
            startTime: Date.now(),
            toolCallEvents: [],
            historyPayload: futureMessages
        }];
        targetMessage.activeResponseIndex = 0;
    }

    // Fix potential legacy data where activeResponseIndex is undefined
    if (targetMessage.activeResponseIndex === undefined) {
        targetMessage.activeResponseIndex = 0;
    }

    const currentResponseIndex = targetMessage.activeResponseIndex;
    
    // Save state of current response specifically.
    // IMPORTANT: We explicitly assign the future messages to the payload of the CURRENT index
    // before we switch to the new index. This "freezes" the timeline for the old response.
    if (targetMessage.responses[currentResponseIndex]) {
        targetMessage.responses[currentResponseIndex].historyPayload = futureMessages;
    }

    // Create new empty response slot
    const newResponse: ModelResponse = { 
        text: '', 
        toolCallEvents: [], 
        startTime: Date.now(),
        historyPayload: [] // New branch starts with no future
    };
    
    targetMessage.responses.push(newResponse);
    targetMessage.activeResponseIndex = targetMessage.responses.length - 1;
    targetMessage.isThinking = true;

    // Return truncated list (this message is now the tip of the spear)
    const truncatedList = [...updatedMessages.slice(0, messageIndex), targetMessage];

    return { updatedMessages: truncatedList, targetMessage };
};

/**
 * Navigates between existing branches (versions) of a message.
 * Restores the "Future" context associated with that specific version.
 */
export const navigateBranch = (
    messages: Message[],
    messageId: string,
    direction: 'next' | 'prev'
): { updatedMessages: Message[] } | null => {
    
    const messageIndex = messages.findIndex(m => m.id === messageId);
    if (messageIndex === -1) return null;

    const updatedMessages = deepClone(messages);
    const targetMessage = updatedMessages[messageIndex];
    
    // Helper to get total count based on role
    const getCount = () => targetMessage.role === 'user' 
        ? (targetMessage.versions?.length || 1) 
        : (targetMessage.responses?.length || 1);
        
    const getActiveIndex = () => targetMessage.role === 'user'
        ? (targetMessage.activeVersionIndex ?? 0)
        : (targetMessage.activeResponseIndex ?? 0);

    const total = getCount();
    const currentIdx = getActiveIndex();
    
    // If only 1 version exists, we can't navigate
    if (total < 2) return null;

    let newIdx = direction === 'next' ? currentIdx + 1 : currentIdx - 1;
    if (newIdx < 0) newIdx = 0;
    if (newIdx >= total) newIdx = total - 1;
    
    if (newIdx === currentIdx) return null;

    // 1. Save current future to the *current* index slot
    // This snapshot ensures if we come back to this branch, the future matches what we left.
    const currentFuture = updatedMessages.slice(messageIndex + 1);
    
    if (targetMessage.role === 'user') {
        if (!targetMessage.versions) targetMessage.versions = [{ text: targetMessage.text, createdAt: Date.now() }];
        // Ensure array exists at index
        if (targetMessage.versions[currentIdx]) {
            targetMessage.versions[currentIdx].historyPayload = currentFuture;
        }
    } else {
        if (!targetMessage.responses) targetMessage.responses = [{ text: targetMessage.text, startTime: Date.now() }];
        if (targetMessage.responses[currentIdx]) {
            targetMessage.responses[currentIdx].historyPayload = currentFuture;
        }
    }

    // 2. Restore future from the *new* index slot
    let restoredFuture: Message[] = [];
    
    if (targetMessage.role === 'user') {
        const targetVersion = targetMessage.versions![newIdx];
        if (targetVersion) {
            targetMessage.text = targetVersion.text;
            targetMessage.attachments = targetVersion.attachments;
            targetMessage.activeVersionIndex = newIdx;
            restoredFuture = targetVersion.historyPayload || [];
        }
    } else {
        const targetResponse = targetMessage.responses![newIdx];
        if (targetResponse) {
            targetMessage.activeResponseIndex = newIdx;
            // Also restore the main text display properties for legacy views if needed, 
            // though AiMessage component mostly reads from responses[index]
            restoredFuture = targetResponse.historyPayload || [];
        }
    }

    // Reconstruct the linear history: [Past] + [Switched Node] + [Restored Future]
    const newMessagesList = [
        ...updatedMessages.slice(0, messageIndex), 
        targetMessage, 
        ...restoredFuture
    ];

    return { updatedMessages: newMessagesList };
};
