
/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useRef, useState, useCallback } from 'react';
import { motion as motionTyped, AnimatePresence } from 'framer-motion';
const motion = motionTyped as any;
import { MessageList, type MessageListHandle } from './MessageList';
import { MessageForm, type MessageFormHandle } from './MessageForm/index';
import type { Message, Source } from '../../types';
import { isUsingCustomBaseUrl, resetApiBaseUrl, getApiBaseUrl } from '../../utils/api';

type ChatAreaProps = {
  messages: Message[];
  isLoading: boolean;
  isHistoryLoading: boolean; // New prop
  isAppLoading: boolean;
  sendMessage: (message: string, files?: File[], options?: { isHidden?: boolean; isThinkingModeEnabled?: boolean; }) => void;
  onCancel: () => void;
  ttsVoice: string;
  ttsModel: string;
  setTtsVoice: (voice: string) => void;
  currentChatId: string | null;
  activeModel: string;
  provider?: string;
  onShowSources: (sources: Source[]) => void;
  messageListRef: React.RefObject<MessageListHandle>;
  onRegenerate: (messageId: string) => void;
  onSetActiveResponseIndex: (messageId: string, index: number) => void;
  backendStatus: 'online' | 'offline' | 'checking';
  backendError: string | null;
  onRetryConnection: () => void;
  hasApiKey: boolean;
  onEditMessage?: (messageId: string, newText: string) => void;
  onNavigateBranch?: (messageId: string, direction: 'next' | 'prev') => void;
};

const ConfigWarning = ({ hasApiKey, backendStatus, backendError, onRetry }: { hasApiKey: boolean, backendStatus: string, backendError: string | null, onRetry: () => void }) => {
    const isCustomUrl = isUsingCustomBaseUrl();
    const customUrl = isCustomUrl ? getApiBaseUrl() : '';

    if (backendStatus === 'offline') {
        return (
            <div className="mx-4 mb-4 p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800/50 rounded-xl flex flex-col gap-3 animate-in slide-in-from-bottom-2 fade-in shadow-sm">
                <div className="flex items-center gap-3">
                    <div className="p-2 bg-red-100 dark:bg-red-900/40 rounded-full flex-shrink-0 text-red-600 dark:text-red-400">
                        <svg className="w-5 h-5" viewBox="0 0 20 20" fill="currentColor">
                            <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.28 7.22a.75.75 0 00-1.06 1.06L8.94 10l-1.72 1.72a.75.75 0 101.06 1.06L10 11.06l1.72 1.72a.75.75 0 101.06-1.06L11.06 10l1.72-1.72a.75.75 0 00-1.06-1.06L10 8.94 8.28 7.22z" clipRule="evenodd" />
                        </svg>
                    </div>
                    <div>
                        <p className="text-sm font-bold text-red-900 dark:text-red-200">Backend Connection Failed</p>
                        <p className="text-xs text-red-700 dark:text-red-300/80 mt-0.5">
                            {isCustomUrl ? `Could not reach custom server: ${customUrl}` : (backendError || "Could not reach the server.")}
                        </p>
                    </div>
                </div>
                <div className="flex justify-end gap-2">
                    {isCustomUrl && (
                        <button
                            onClick={resetApiBaseUrl}
                            className="px-3 py-1.5 bg-white dark:bg-white/10 text-xs font-semibold rounded-lg shadow-sm border border-red-200 dark:border-red-800 hover:bg-red-50 dark:hover:bg-white/20 transition-colors text-red-800 dark:text-red-100 whitespace-nowrap"
                        >
                            Reset to Default Server
                        </button>
                    )}
                    <button 
                        onClick={onRetry} 
                        className="px-3 py-1.5 bg-red-600 hover:bg-red-700 text-white text-xs font-semibold rounded-lg shadow-sm transition-colors whitespace-nowrap"
                    >
                        Retry Connection
                    </button>
                </div>
            </div>
        );
    }

    if (!hasApiKey) {
        return (
            <div className="mx-4 mb-4 p-4 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800/50 rounded-xl flex flex-col gap-3 animate-in slide-in-from-bottom-2 fade-in shadow-sm">
                <div className="flex items-center gap-3">
                    <div className="p-2 bg-amber-100 dark:bg-amber-900/40 rounded-full flex-shrink-0 text-amber-600 dark:text-amber-400">
                         <svg className="w-5 h-5" viewBox="0 0 20 20" fill="currentColor">
                            <path fillRule="evenodd" d="M8.485 2.495c.673-1.167 2.357-1.167 3.03 0l6.28 10.875c.673 1.167-.17 2.625-1.516 2.625H3.72c-1.347 0-2.189-1.458-1.515-2.625L8.485 2.495zM10 5a.75.75 0 01.75.75v3.5a.75.75 0 01-1.5 0V5.75A.75.75 0 0110 5zm0 9a1 1 0 100-2 1 1 0 000 2z" clipRule="evenodd" />
                        </svg>
                    </div>
                    <div>
                        <p className="text-sm font-bold text-amber-900 dark:text-amber-200">Configuration Required</p>
                        <p className="text-xs text-amber-700 dark:text-amber-300/80 mt-0.5">
                            {isCustomUrl 
                                ? `Connected to custom server (${customUrl}). API Key may be missing on both client and server.` 
                                : "Please configure your API key in Settings to start chatting."
                            }
                        </p>
                    </div>
                </div>
                <div className="flex justify-end gap-2">
                    {isCustomUrl && (
                        <button
                            onClick={resetApiBaseUrl}
                            className="px-3 py-1.5 bg-white dark:bg-white/10 text-xs font-semibold rounded-lg shadow-sm border border-amber-200 dark:border-amber-800 hover:bg-amber-50 dark:hover:bg-white/20 transition-colors text-amber-800 dark:text-amber-100 whitespace-nowrap"
                        >
                            Reset Server URL
                        </button>
                    )}
                    <button 
                        onClick={() => window.dispatchEvent(new CustomEvent('open-settings'))}
                        className="px-3 py-1.5 bg-amber-600 hover:bg-amber-700 text-white text-xs font-semibold rounded-lg shadow-sm transition-colors whitespace-nowrap"
                    >
                        Open Settings
                    </button>
                </div>
            </div>
        );
    }
    return null;
};

export const ChatArea = ({ 
    messages, isLoading, isHistoryLoading, isAppLoading, sendMessage, onCancel, 
    ttsVoice, ttsModel, setTtsVoice, currentChatId, activeModel, provider,
    onShowSources,
    messageListRef, onRegenerate, onSetActiveResponseIndex,
    backendStatus, backendError, onRetryConnection, hasApiKey,
    onEditMessage, onNavigateBranch
}: ChatAreaProps) => {
  const messageFormRef = useRef<MessageFormHandle>(null);
  const [isDragging, setIsDragging] = useState(false);
  
  const dragCounter = useRef(0);

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
  };

  const handleDragIn = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    dragCounter.current++;
    if (e.dataTransfer.items && e.dataTransfer.items.length > 0) {
      setIsDragging(true);
    }
  };

  const handleDragOut = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    dragCounter.current--;
    if (dragCounter.current === 0) {
      setIsDragging(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
    dragCounter.current = 0;
    const files = e.dataTransfer.files;
    if (files && files.length > 0) {
      messageFormRef.current?.attachFiles(Array.from(files));
    }
  };

  const handleSetActiveResponseIndex = useCallback((messageId: string, index: number) => {
    if (currentChatId) {
      onSetActiveResponseIndex(messageId, index);
    }
  }, [currentChatId, onSetActiveResponseIndex]);

  return (
    <div 
      className="flex-1 flex flex-col min-h-0 relative"
      onDragEnter={handleDragIn}
      onDragLeave={handleDragOut}
      onDragOver={handleDrag}
      onDrop={handleDrop}
    >
      <AnimatePresence>
        {isDragging && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 bg-indigo-500/10 dark:bg-indigo-400/10 border-2 border-dashed border-indigo-500 dark:border-indigo-400 rounded-2xl z-30 flex items-center justify-center m-4 pointer-events-none"
          >
            <div className="text-center font-bold text-indigo-600 dark:text-indigo-300 bg-white/80 dark:bg-black/80 px-6 py-4 rounded-xl shadow-lg backdrop-blur-sm">
              <p className="text-lg">Drop files to attach</p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
      <MessageList
          key={currentChatId || 'empty'}
          ref={messageListRef}
          messages={messages} 
          sendMessage={sendMessage} 
          isLoading={isLoading} 
          isHistoryLoading={isHistoryLoading} // Pass prop
          ttsVoice={ttsVoice}
          ttsModel={ttsModel} 
          currentChatId={currentChatId} 
          activeModel={activeModel}
          provider={provider}
          onShowSources={onShowSources}
          messageFormRef={messageFormRef}
          onRegenerate={onRegenerate}
          onSetActiveResponseIndex={handleSetActiveResponseIndex}
          onEditMessage={onEditMessage}
          onNavigateBranch={onNavigateBranch}
      />
      <div className="p-4 sm:px-8 pb-6 flex-shrink-0 z-20 flex flex-col">
          <ConfigWarning 
              hasApiKey={hasApiKey} 
              backendStatus={backendStatus} 
              backendError={backendError} 
              onRetry={onRetryConnection} 
          />
          <MessageForm
            ref={messageFormRef}
            onSubmit={sendMessage} 
            isLoading={isLoading} 
            isAppLoading={isAppLoading}
            backendStatus={backendStatus}
            onCancel={onCancel}
            messages={messages}
            hasApiKey={hasApiKey}
            ttsVoice={ttsVoice}
            setTtsVoice={setTtsVoice}
            currentChatId={currentChatId}
            activeModel={activeModel}
          />
      </div>
    </div>
  );
};
