/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useRef, useEffect, useMemo } from 'react';
import { type MessageFormHandle, type ProcessedFile } from './types';
import { useFileHandling } from './useFileHandling';
import { useInputEnhancements } from './useInputEnhancements';
import type { Message } from '../../../types';
import { usePlaceholder } from '../../../hooks/usePlaceholder';
import { storage } from '../../../utils/storage';

export const useMessageForm = (
  onSubmit: (message: string, files?: File[], options?: { isThinkingModeEnabled?: boolean }) => void,
  isLoading: boolean,
  ref: React.ForwardedRef<MessageFormHandle>,
  messages: Message[],
  isAgentMode: boolean,
  hasApiKey: boolean
) => {
  const [inputValue, setInputValue] = useState('');
  const [isExpanded, setIsExpanded] = useState(false);
  const [isUploadMenuOpen, setIsUploadMenuOpen] = useState(false);
  const [isFocused, setIsFocused] = useState(false);
  const [previewFile, setPreviewFile] = useState<ProcessedFile | null>(null);
  const isHydrated = useRef(false);

  const inputRef = useRef<HTMLTextAreaElement>(null);
  const attachButtonRef = useRef<HTMLButtonElement>(null);
  const uploadMenuRef = useRef<HTMLDivElement>(null);

  const fileHandling = useFileHandling(ref);
  const enhancements = useInputEnhancements(inputValue, setInputValue, fileHandling.processedFiles.length > 0, onSubmit);
  
  const lastMessageText = useMemo(() => {
    const lastVisibleMessage = messages.filter(m => !m.isHidden).pop();
    if (!lastVisibleMessage) return '';
    if (lastVisibleMessage.role === 'model') {
        const activeResponse = lastVisibleMessage.responses?.[lastVisibleMessage.activeResponseIndex];
        return activeResponse?.text || '';
    }
    return lastVisibleMessage.text || '';
  }, [messages]);

  const placeholder = usePlaceholder(!inputValue.trim() && !isFocused, lastMessageText, false, hasApiKey);

  useEffect(() => {
    // Restore text draft from IDB on initial load
    const restore = async () => {
        try {
            const savedText = await storage.loadTextDraft();
            if (savedText) {
                setInputValue(savedText);
            }
        } catch (e) { /* ignore */ }
        finally {
            isHydrated.current = true;
        }
    };
    restore();
  }, []);

  useEffect(() => {
    if (!isHydrated.current) return;

    // Save text draft to IDB
    const save = async () => {
        try {
            await storage.saveTextDraft(inputValue);
        } catch (e) { /* ignore */ }
    };

    const timer = setTimeout(save, 500);
    return () => clearTimeout(timer);
  }, [inputValue]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (isUploadMenuOpen && attachButtonRef.current && !attachButtonRef.current.contains(event.target as Node) && uploadMenuRef.current && !uploadMenuRef.current.contains(event.target as Node)) {
        setIsUploadMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isUploadMenuOpen]);

  const clearDraft = () => {
    setInputValue('');
    fileHandling.clearFiles(); 
    setPreviewFile(null);
    storage.clearAllDrafts().catch(console.error);
  };

  const isProcessingFiles = fileHandling.processedFiles.some(f => f.progress < 100 && !f.error);
  const hasContent = inputValue.trim().length > 0 || fileHandling.processedFiles.length > 0;
  
  const canSubmit = hasContent && !isLoading && !enhancements.isEnhancing && !isProcessingFiles;

  const handleSubmit = (e?: React.FormEvent) => {
    e?.preventDefault();

    if (enhancements.isRecording) {
        enhancements.stopRecording();
    }
    
    if (!canSubmit) {
        return;
    }

    onSubmit(inputValue, fileHandling.getFilesToSend());
    clearDraft();
  };

  const handlePaste = (e: React.ClipboardEvent<HTMLTextAreaElement>) => {
    if (e.clipboardData.files?.length > 0) {
      e.preventDefault();
      fileHandling.processAndSetFiles(Array.from(e.clipboardData.files));
    }
  };
  
  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        if (canSubmit) {
            handleSubmit();
        }
    }
    if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        if (canSubmit) {
            handleSubmit();
        }
    }
  };

  return {
    inputValue, setInputValue,
    isExpanded, isUploadMenuOpen, setIsUploadMenuOpen,
    isFocused, setIsFocused,
    previewFile, setPreviewFile, 
    placeholder,
    inputRef, attachButtonRef, uploadMenuRef,
    handleSubmit, handlePaste, handleKeyDown,
    canSubmit, 
    isProcessingFiles,
    ...fileHandling,
    ...enhancements,
  };
};
