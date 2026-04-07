
/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useRef, useEffect } from 'react';
import { motion as motionTyped, AnimatePresence } from 'framer-motion';
const motion = motionTyped as any;
import { MarkdownComponents } from '../Markdown/markdownComponents';
import type { Message } from '../../types';
import { FileIcon } from '../UI/FileIcon';
import { ManualCodeRenderer } from '../Markdown/ManualCodeRenderer';
import { BranchSwitcher } from '../UI/BranchSwitcher';

// Optimized spring physics for performance
const animationProps = {
  initial: { opacity: 0, y: 15, scale: 0.98 },
  animate: { opacity: 1, y: 0, scale: 1 },
  transition: { type: "spring", stiffness: 200, damping: 25 },
};

export const UserMessage = ({ 
    msg, 
    onEdit,
    onBranchSwitch 
}: { 
    msg: Message, 
    onEdit?: (newText: string) => void,
    onBranchSwitch?: (direction: 'next' | 'prev') => void
}) => {
  const { text, attachments, versions, activeVersionIndex } = msg;
  const [isCopied, setIsCopied] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [editText, setEditedText] = useState(text);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const versionCount = versions ? versions.length : 1;
  const currentVersionIdx = activeVersionIndex ?? 0;

  useEffect(() => {
      if (isEditing) {
          setEditedText(text); // Reset text when entering edit mode to ensure fresh state
          if (textareaRef.current) {
              // Defer focus slightly to ensure DOM is ready
              setTimeout(() => {
                  if (textareaRef.current) {
                      textareaRef.current.focus();
                      // Move cursor to end
                      textareaRef.current.setSelectionRange(textareaRef.current.value.length, textareaRef.current.value.length);
                  }
              }, 0);
          }
      }
  }, [isEditing, text]);

  const handleCopy = () => {
      if (!text) return;
      navigator.clipboard.writeText(text).then(() => {
          setIsCopied(true);
          setTimeout(() => setIsCopied(false), 2000);
      }).catch(err => console.error('Failed to copy text: ', err));
  };

  const handleEditSave = () => {
      // Allow saving even if text hasn't changed to trigger regeneration/new branch if desired
      if (editText.trim().length === 0) return; // Prevent empty messages
      
      onEdit?.(editText);
      setIsEditing(false);
  };

  const handleEditCancel = () => {
      setEditedText(text);
      setIsEditing(false);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
      if (e.key === 'Enter' && !e.shiftKey) {
          e.preventDefault();
          handleEditSave();
      }
      if (e.key === 'Escape') {
          handleEditCancel();
      }
  };
  
  if (isEditing) {
      return (
        <div className="w-full flex justify-end pb-2">
            <div className="w-full max-w-[85%] sm:max-w-[80%] bg-layer-2 rounded-2xl border border-primary-main shadow-md p-3 flex flex-col gap-2">
               <div className="grid w-full">
                   <div 
                       className="w-full bg-transparent text-content-primary text-base leading-relaxed p-1 invisible whitespace-pre-wrap break-words col-start-1 row-start-1"
                       aria-hidden="true"
                   >
                       {editText + ' '}
                   </div>
                   <textarea 
                        ref={textareaRef}
                        value={editText}
                        onChange={(e) => setEditedText(e.target.value)}
                        onKeyDown={handleKeyDown}
                        aria-label="Edit message text"
                        className="w-full bg-transparent text-content-primary resize-none focus:outline-none text-base leading-relaxed p-1 col-start-1 row-start-1 h-full overflow-hidden"
                        rows={1}
                   />
               </div>
               <div className="flex justify-end gap-2 mt-1">
                   <button 
                        onClick={handleEditCancel}
                        aria-label="Cancel edit"
                        className="px-3 py-1.5 text-xs font-semibold text-content-secondary hover:text-content-primary hover:bg-layer-3 rounded-lg transition-colors border border-border-default"
                   >
                       Cancel
                   </button>
                   <button 
                        onClick={handleEditSave}
                        disabled={editText.trim().length === 0}
                        aria-label="Save and submit edit"
                        className="px-3 py-1.5 text-xs font-semibold text-text-inverted bg-primary-main hover:bg-primary-hover rounded-lg transition-colors shadow-sm disabled:opacity-50 disabled:cursor-not-allowed"
                   >
                       Save & Submit
                   </button>
               </div>
            </div>
        </div>
      );
  }
  
  return (
    <div className="w-full flex justify-end group/userMsg pb-2">
        <div className="w-fit max-w-[85%] sm:max-w-[80%] flex flex-col items-end min-w-0">
            <motion.div 
                {...animationProps} 
                className="bg-message-user text-content-primary rounded-2xl rounded-tr-md shadow-sm border border-border-default origin-bottom-right overflow-hidden relative z-0 max-w-full"
            >
                {/* Content Section */}
                <div className="px-5 py-3.5 flex flex-col gap-3 min-w-0">
                    {attachments && attachments.length > 0 && (
                        <div className="flex flex-wrap gap-2 p-1">
                            {attachments.map((attachment, index) => {
                                const isImage = attachment.mimeType.startsWith('image/');
                                const src = `data:${attachment.mimeType};base64,${attachment.data}`;
                                
                                if (isImage) {
                                    return (
                                        <div key={index} className="relative rounded-lg overflow-hidden border border-border-strong group">
                                            <img 
                                                src={src} 
                                                alt={attachment.name} 
                                                className="max-h-64 max-w-full object-contain bg-layer-2" 
                                                loading="lazy"
                                            />
                                            <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-end p-2">
                                                <p className="text-xs text-white truncate font-medium">{attachment.name}</p>
                                            </div>
                                        </div>
                                    );
                                }

                                return (
                                    <div key={index} className="flex items-center gap-3 p-2 bg-layer-1 rounded-lg border border-border-default min-w-[200px]">
                                        <FileIcon filename={attachment.name} className="flex-shrink-0 w-8 h-8 text-primary-main" />
                                        <div className="flex-1 min-w-0">
                                            <p className="truncate text-sm font-medium text-content-primary" title={attachment.name}>{attachment.name}</p>
                                            <p className="text-xs text-content-tertiary uppercase">{attachment.mimeType.split('/').pop()}</p>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    )}
                    {text && (
                        <div className="markdown-content markdown-content-user text-base leading-relaxed text-content-primary break-words whitespace-pre-wrap min-w-0">
                            <ManualCodeRenderer text={text} components={MarkdownComponents} isStreaming={false} />
                        </div>
                    )}
                </div>
            </motion.div>

            {/* Actions Row */}
            <div className="flex items-center gap-2 mt-1 mr-1 select-none">
                {/* Copy Button */}
                <button 
                    type="button"
                    onClick={handleCopy}
                    className="p-1.5 rounded-lg text-content-tertiary hover:text-content-primary hover:bg-layer-2 transition-colors focus:opacity-100"
                    title="Copy text"
                    aria-label="Copy message text"
                >
                    <AnimatePresence mode='wait' initial={false}>
                        {isCopied ? (
                            <motion.svg 
                                key="check" 
                                initial={{ scale: 0.5, opacity: 0 }} 
                                animate={{ scale: 1, opacity: 1 }} 
                                exit={{ scale: 0.5, opacity: 0 }} 
                                width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" 
                                className="text-status-success-text"
                            >
                                <polyline points="20 6 9 17 4 12"></polyline>
                            </motion.svg>
                        ) : (
                            <motion.svg 
                                key="copy" 
                                initial={{ scale: 0.5, opacity: 0 }} 
                                animate={{ scale: 1, opacity: 1 }} 
                                exit={{ scale: 0.5, opacity: 0 }} 
                                width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
                            >
                                <rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect>
                                <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path>
                            </motion.svg>
                        )}
                    </AnimatePresence>
                </button>

                {/* Edit Button */}
                {onEdit && (
                    <button 
                        type="button"
                        className="p-1.5 rounded-lg text-content-tertiary hover:text-content-primary hover:bg-layer-2 transition-colors focus:opacity-100"
                        title="Edit and Branch"
                        aria-label="Edit message"
                        onClick={() => setIsEditing(true)}
                    >
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path>
                            <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path>
                        </svg>
                    </button>
                )}

                {/* Branch Switcher (Moved to end) */}
                {versionCount > 1 && onBranchSwitch && (
                    <BranchSwitcher 
                        count={versionCount} 
                        activeIndex={currentVersionIdx} 
                        onChange={(idx) => onBranchSwitch(idx > currentVersionIdx ? 'next' : 'prev')}
                        className="ml-1 border border-border-default" 
                    />
                )}
            </div>
        </div>
    </div>
  );
};
