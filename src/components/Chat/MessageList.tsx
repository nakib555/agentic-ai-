
/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useRef, useState, forwardRef, useImperativeHandle, useCallback, useMemo, Suspense, useEffect } from 'react';
import type { Message, Source } from '../../types';
import { MessageComponent } from './Message';
import type { MessageFormHandle } from './MessageForm/index';
import { AnimatePresence, motion as motionTyped } from 'framer-motion';
import { Virtuoso, VirtuosoHandle } from 'react-virtuoso';
import { useViewport } from '../../hooks/useViewport';

const motion = motionTyped as any;

// Safe lazy loads
const WelcomeScreen = React.lazy(() => import('./WelcomeScreen/index').then(m => ({ default: m.WelcomeScreen })));
const ChatSkeleton = React.lazy(() => import('../UI/ChatSkeleton').then(m => ({ default: m.ChatSkeleton })));

export type MessageListHandle = {
  scrollToBottom: () => void;
  scrollToMessage: (messageId: string) => void;
};

type MessageListProps = {
  messages: Message[];
  sendMessage: (message: string, files?: File[], options?: { isHidden?: boolean; isThinkingModeEnabled?: boolean; }) => void;
  isLoading: boolean;
  ttsVoice: string;
  ttsModel: string;
  currentChatId: string | null;
  onShowSources: (sources: Source[]) => void;
  messageFormRef: React.RefObject<MessageFormHandle>;
  onRegenerate: (messageId: string) => void;
  onSetActiveResponseIndex: (messageId: string, index: number) => void;
  onEditMessage?: (messageId: string, newText: string) => void;
  onNavigateBranch?: (messageId: string, direction: 'next' | 'prev') => void;
};

// Wrapper to inject context (like previous user message)
// We memoize this to prevent re-creation if props haven't changed.
const MessageWrapper = React.memo(({ 
    msg,
    index,
    isLast,
    messages,
    contextProps
}: { 
    msg: Message;
    index: number;
    isLast: boolean;
    messages: Message[];
    contextProps: Omit<MessageListProps, 'messages'>;
}) => {
    // Determine context for AI messages (the prompt that triggered it)
    let userQuery = '';
    if (msg.role === 'model') {
        // Find the most recent user message before this one
        for (let i = index - 1; i >= 0; i--) {
            if (messages[i].role === 'user' && !messages[i].isHidden) {
                userQuery = messages[i].text;
                break;
            }
        }
    }

    return (
        <MessageComponent 
            msg={msg} 
            isLast={isLast}
            {...contextProps}
            // Pass the custom prop to AiMessage via MessageComponent
            {...({ userQuery } as any)} 
        />
    );
});

export const MessageList = forwardRef<MessageListHandle, MessageListProps>(({ 
    messages, sendMessage, isLoading, ttsVoice, ttsModel, currentChatId, 
    onShowSources, messageFormRef, onRegenerate, onSetActiveResponseIndex,
    onEditMessage, onNavigateBranch
}, ref) => {
  const virtuosoRef = useRef<VirtuosoHandle>(null);
  const [showScrollButton, setShowScrollButton] = useState(false);
  const [atBottom, setAtBottom] = useState(true);
  const { isDesktop } = useViewport();

  // Safeguard against undefined messages prop
  const visibleMessages = useMemo(() => (messages || []).filter(msg => !msg.isHidden), [messages]);
  
  // Track previous length to detect new messages
  const prevMessagesLength = useRef(visibleMessages.length);

  // Auto-scroll on new message
  useEffect(() => {
      const currentLength = visibleMessages.length;
      const prevLength = prevMessagesLength.current;

      if (currentLength > prevLength) {
          const lastMessage = visibleMessages[currentLength - 1];
          // Scroll if it's a user message (always show what I just sent)
          // OR if we were already at the bottom (standard sticky behavior)
          const shouldScroll = lastMessage?.role === 'user' || atBottom;

          if (shouldScroll) {
              // Use setTimeout to ensure DOM has updated with the new item
              setTimeout(() => {
                  virtuosoRef.current?.scrollToIndex({ 
                      index: currentLength - 1, 
                      align: 'end',
                      behavior: 'smooth' 
                  });
              }, 50);
          }
      }
      
      prevMessagesLength.current = currentLength;
  }, [visibleMessages, atBottom]);

  // Expose scroll methods to parent via ref
  useImperativeHandle(ref, () => ({
    scrollToBottom: () => {
      // Use smooth scrolling only when triggered manually
      virtuosoRef.current?.scrollToIndex({ index: visibleMessages.length - 1, behavior: 'smooth', align: 'end' });
    },
    scrollToMessage: (messageId: string) => {
        const index = visibleMessages.findIndex(m => m.id === messageId);
        if (index !== -1 && virtuosoRef.current) {
            virtuosoRef.current.scrollToIndex({ index, behavior: 'smooth', align: 'center' });
        }
    }
  }));

  const handleScrollToBottom = useCallback(() => {
      virtuosoRef.current?.scrollToIndex({ index: visibleMessages.length - 1, behavior: 'smooth', align: 'end' });
  }, [visibleMessages.length]);

  // Memoize the context props object.
  const contextProps = useMemo(() => ({
      sendMessage, isLoading, ttsVoice, ttsModel, currentChatId,
      onShowSources, messageFormRef,
      onRegenerate, onSetActiveResponseIndex, onEditMessage,
      onNavigateBranch
  }), [
      sendMessage, isLoading, ttsVoice, ttsModel, currentChatId,
      onShowSources, messageFormRef,
      onRegenerate, onSetActiveResponseIndex, onEditMessage,
      onNavigateBranch
  ]);

  // Memoize itemContent so Virtuoso doesn't re-render all items on every parent render
  const itemContent = useCallback((index: number, msg: Message) => (
      <div className="px-4 sm:px-6 md:px-8 max-w-4xl mx-auto w-full py-2 sm:py-4">
          <MessageWrapper 
              msg={msg}
              index={index}
              isLast={index === visibleMessages.length - 1}
              messages={visibleMessages}
              contextProps={contextProps}
          />
      </div>
  ), [visibleMessages, contextProps]);

  return (
    <div className="flex-1 min-h-0 relative w-full">
      {visibleMessages.length === 0 ? (
        isLoading ? (
            <div className="h-full w-full bg-transparent">
                <Suspense fallback={null}>
                    <ChatSkeleton />
                </Suspense>
            </div>
        ) : (
            <div className="h-full overflow-y-auto custom-scrollbar">
                 <Suspense fallback={<div className="h-full flex items-center justify-center"><div className="animate-spin w-6 h-6 border-2 border-indigo-500 rounded-full border-t-transparent"></div></div>}>
                    <WelcomeScreen sendMessage={sendMessage} />
                 </Suspense>
            </div>
        )
      ) : (
        <div className="h-full" role="log" aria-live="polite">
            <Virtuoso
                ref={virtuosoRef}
                style={{ height: '100%', width: '100%' }}
                data={visibleMessages}
                followOutput={atBottom ? "auto" : false} 
                increaseViewportBy={600} 
                overscan={400} 
                initialTopMostItemIndex={visibleMessages.length - 1}
                atBottomStateChange={(isAtBottom) => {
                    setAtBottom(isAtBottom);
                    setShowScrollButton(!isAtBottom);
                }}
                atBottomThreshold={100}
                className="custom-scrollbar"
                itemContent={itemContent}
                components={{
                    Header: () => <div className="h-4 md:h-6" />,
                    Footer: () => <div className="h-4 md:h-6" />
                }}
            />
        </div>
      )}

      <AnimatePresence>
        {showScrollButton && (
          <motion.div
             initial={{ opacity: 0, y: 10, scale: 0.9 }}
             animate={{ opacity: 1, y: 0, scale: 1 }}
             exit={{ opacity: 0, y: 10, scale: 0.9 }}
             transition={{ type: "spring", stiffness: 400, damping: 30 }}
             className="absolute bottom-6 md:bottom-4 inset-x-0 flex justify-center pointer-events-none z-30"
          >
            <button
                onClick={handleScrollToBottom}
                className="pointer-events-auto group flex items-center gap-2 px-4 py-2.5 bg-white/80 dark:bg-gray-800/80 backdrop-blur-md text-sm font-semibold text-gray-700 dark:text-gray-200 shadow-xl hover:shadow-2xl border border-gray-200/50 dark:border-white/10 rounded-full transition-all transform hover:-translate-y-1 active:scale-95 ring-1 ring-black/5 dark:ring-white/5"
                aria-label="Scroll to latest messages"
            >
                {!atBottom && isLoading && (
                    <span className="relative flex h-2 w-2 mr-1.5">
                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-indigo-400 opacity-75"></span>
                      <span className="relative inline-flex rounded-full h-2 w-2 bg-indigo-500"></span>
                    </span>
                )}
                <span>Scroll to Bottom</span>
                <svg className="w-4 h-4 text-gray-500 dark:text-gray-400 group-hover:text-indigo-500 dark:group-hover:text-indigo-400 transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M19 14l-7 7m0 0l-7-7m7 7V3" />
                </svg>
            </button>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
});
