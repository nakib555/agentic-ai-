/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { forwardRef, useState, Suspense, useCallback } from 'react';
import { AnimatePresence, motion as motionTyped } from 'framer-motion';
import { useDropzone } from 'react-dropzone';
import { Mic, Send, Paperclip, Sparkles, X, Plus } from 'lucide-react';
import { useMessageForm } from './useMessageForm';
import { UploadMenu } from './UploadMenu';
import { VoiceVisualizer } from '../../UI/VoiceVisualizer';
import { MessageFormHandle } from './types';
import { Message } from '../../../types';
import { TextType } from '../../UI/TextType';
import { Tooltip } from '../../UI/Tooltip';
import { AttachedFilePreview } from './AttachedFilePreview';

const motion = motionTyped as any;

const FilePreviewSidebar = React.lazy(() => import('./FilePreviewSidebar').then(m => ({ default: m.FilePreviewSidebar })));

type MessageFormProps = {
  onSubmit: (message: string, files?: File[], options?: { isHidden?: boolean; isThinkingModeEnabled?: boolean; }) => void;
  isLoading: boolean;
  isAppLoading: boolean;
  backendStatus: 'online' | 'offline' | 'checking';
  onCancel: () => void;
  messages: Message[];
  hasApiKey: boolean;
  ttsVoice: string;
  setTtsVoice: (voice: string) => void;
  currentChatId: string | null;
  activeModel: string;
};

export const MessageForm = forwardRef<MessageFormHandle, MessageFormProps>((props, ref) => {
  const { 
    onSubmit, isLoading, isAppLoading, backendStatus, onCancel, 
    hasApiKey 
  } = props;

  const logic = useMessageForm(
    (msg, files, options) => onSubmit(msg, files, { ...options, isThinkingModeEnabled: false }),
    isLoading,
    ref,
    props.messages,
    false,
    hasApiKey
  );

  const onDrop = useCallback((acceptedFiles: File[]) => {
      if (acceptedFiles.length > 0) {
          logic.processAndSetFiles(acceptedFiles);
      }
  }, [logic]);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
      onDrop,
      noClick: true, // We have a separate attach button
      noKeyboard: true
  });

  const isGeneratingResponse = isLoading;
  const isSendDisabled = !logic.canSubmit || isAppLoading || backendStatus === 'offline';
  const hasFiles = logic.processedFiles.length > 0;

  return (
    <div className="w-full mx-auto max-w-4xl relative" {...getRootProps()}>
      <VoiceVisualizer isRecording={logic.isRecording} />

      <AnimatePresence>
        {logic.isUploadMenuOpen && (
          <UploadMenu 
            menuRef={logic.uploadMenuRef}
            onFileClick={() => logic.fileInputRef.current?.click()}
            onFolderClick={() => logic.folderInputRef.current?.click()}
          />
        )}
      </AnimatePresence>

      <Suspense fallback={null}>
          <FilePreviewSidebar 
            isOpen={!!logic.previewFile}
            onClose={() => logic.setPreviewFile(null)}
            file={logic.previewFile}
          />
      </Suspense>

      {/* Hidden inputs managed by logic hook hooks, but we still need them for the menu */}
      <input
        type="file"
        ref={logic.fileInputRef}
        onChange={logic.handleFileChange}
        className="hidden"
        multiple
        aria-hidden="true"
      />
      {/* Dropzone's input */}
      <input {...getInputProps()} className="hidden" />

      <div 
        className={`
            relative bg-transparent border-2 transition-all duration-200 rounded-3xl overflow-hidden shadow-sm flex flex-col
            ${isDragActive 
                ? 'border-primary-main ring-4 ring-primary-subtle bg-primary-subtle scale-[1.01]' 
                : logic.isFocused 
                    ? 'border-primary-main shadow-lg ring-2 ring-primary-subtle' 
                    : 'border-border-default hover:border-border-strong'
            }
        `}
      >
        
        {/* Drop Indicator Overlay */}
        <AnimatePresence>
            {isDragActive && (
                <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    className="absolute inset-0 z-50 flex items-center justify-center bg-white/90 dark:bg-black/90 backdrop-blur-[2px] pointer-events-none"
                >
                    <div className="text-center text-primary-main font-bold text-lg flex items-center gap-2">
                        <Plus className="w-8 h-8 animate-bounce" />
                        Drop to attach
                    </div>
                </motion.div>
            )}
        </AnimatePresence>

        {/* File List Area */}
        <AnimatePresence>
            {hasFiles && (
                <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: 'auto', opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    className="flex flex-nowrap overflow-x-auto gap-3 px-4 pb-3 pt-4 border-b border-border-subtle bg-input-sub scrollbar-hide"
                >
                    {logic.processedFiles.map(file => (
                        <AttachedFilePreview
                            key={file.id}
                            file={file.file}
                            onRemove={() => logic.handleRemoveFile(file.id)}
                            onPreview={() => logic.setPreviewFile(file)}
                            progress={file.progress}
                            error={file.error}
                        />
                    ))}
                </motion.div>
            )}
        </AnimatePresence>

        {/* Text Input */}
        <div className="flex flex-col relative flex-1">
            {!logic.inputValue && !isDragActive && (
               <div className="absolute inset-0 px-4 py-3 pointer-events-none select-none opacity-60 z-0 overflow-hidden">
                  <TextType 
                    text={logic.placeholder} 
                    className="text-content-secondary text-base leading-relaxed"
                    loop 
                    cursorCharacter="|"
                    typingSpeed={30}
                    deletingSpeed={15}
                    pauseDuration={4000}
                  />
               </div>
            )}
            
            <textarea
                id="main-chat-input"
                ref={logic.inputRef}
                value={logic.inputValue}
                onChange={(e) => logic.setInputValue(e.target.value)}
                onKeyDown={logic.handleKeyDown}
                onPaste={logic.handlePaste}
                onFocus={() => logic.setIsFocused(true)}
                onBlur={() => logic.setIsFocused(false)}
                disabled={isGeneratingResponse}
                rows={1}
                aria-label="Message Input"
                className="w-full bg-transparent text-content-primary px-4 pt-3 pb-2 max-h-[120px] focus:outline-none resize-none overflow-y-auto leading-relaxed custom-scrollbar placeholder:text-transparent z-10"
                style={{ minHeight: '3rem' }}
            />
        </div>

        {/* Bottom Toolbar */}
        <div className="flex items-center justify-between px-3 pb-2 pt-1 gap-3 relative z-10 bg-transparent">
            <div className="flex items-center gap-1">
                <Tooltip content="Attach files" position="top">
                    <button
                        ref={logic.attachButtonRef}
                        onClick={() => logic.setIsUploadMenuOpen(!logic.isUploadMenuOpen)}
                        disabled={isGeneratingResponse}
                        className="relative p-2 rounded-xl text-content-secondary hover:text-primary-main hover:bg-layer-2 transition-colors disabled:opacity-50"
                    >
                        <Paperclip className="w-5 h-5" />
                    </button>
                </Tooltip>
            </div>

            <div className="flex items-center gap-2">
                <Tooltip content="Voice Input" position="top">
                    <button
                        onClick={logic.handleMicClick}
                        disabled={isGeneratingResponse || !logic.isSupported}
                        className={`
                            p-2 rounded-xl transition-colors disabled:opacity-50
                            ${logic.isRecording 
                                ? 'bg-status-error-bg text-status-error-text animate-pulse border border-status-error-text' 
                                : 'text-content-secondary hover:text-content-primary hover:bg-layer-2'
                            }
                        `}
                    >
                        <Mic className="w-5 h-5" />
                    </button>
                </Tooltip>

                <Tooltip content="Enhance Prompt" position="top">
                    <button
                        onClick={logic.handleEnhancePrompt}
                        disabled={isGeneratingResponse || !logic.inputValue.trim() || logic.isEnhancing}
                        className={`
                            p-2 rounded-xl transition-all duration-300 disabled:opacity-50
                            ${logic.isEnhancing 
                                ? 'text-primary-main bg-primary-subtle' 
                                : 'text-content-secondary hover:text-primary-main hover:bg-layer-2'
                            }
                        `}
                    >
                        {logic.isEnhancing ? (
                            <div className="animate-spin h-5 w-5 border-2 border-current border-t-transparent rounded-full" />
                        ) : (
                            <Sparkles className="w-5 h-5" />
                        )}
                    </button>
                </Tooltip>

                <Tooltip content={isGeneratingResponse ? "Stop generating" : "Send message"} position="top">
                    <motion.button
                        type="button"
                        onClick={isGeneratingResponse ? onCancel : logic.handleSubmit}
                        disabled={!isGeneratingResponse && isSendDisabled}
                        className={`
                            w-10 h-10 rounded-xl flex items-center justify-center transition-all duration-200 shadow-sm group border
                            ${isGeneratingResponse 
                                ? 'bg-layer-2 border-border-strong hover:bg-layer-3' 
                                : isSendDisabled 
                                    ? 'bg-layer-2 border-border-default text-content-tertiary cursor-not-allowed shadow-none' 
                                    : 'bg-primary-main border-primary-hover text-text-inverted hover:bg-primary-hover hover:shadow-md'
                            }
                        `}
                        whileTap={{ scale: 0.95 }}
                    >
                        {isGeneratingResponse ? ( 
                            <div className="relative w-5 h-5 flex items-center justify-center">
                                <X className="w-4 h-4 text-status-error-text" />
                            </div>
                        ) : ( 
                            <Send className="w-5 h-5 ml-0.5" />
                        )}
                    </motion.button>
                </Tooltip>
            </div>
        </div>
      </div>

      <div className="flex justify-center items-center pt-3 pb-0">
          <motion.p 
            initial={{ opacity: 0, y: 5 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.5, duration: 0.5 }}
            className="text-[11px] font-medium text-content-tertiary select-none"
          >
             Agentic AI can make mistakes.
          </motion.p>
      </div>
    </div>
  );
});