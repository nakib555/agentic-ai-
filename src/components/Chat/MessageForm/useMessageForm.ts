
/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

// This is the simplified main hook for the MessageForm component.
// It composes smaller, more focused hooks for file handling and input enhancements.

import React, { useState, useRef, useEffect, useLayoutEffect, useMemo } from 'react';
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
  
  // Track previous length to optimize resizing logic
  const prevValueLength = useRef(0);

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

  // Always pass false for agent mode to placeholder hook
  const placeholder = usePlaceholder(!inputValue.trim() && !isFocused, lastMessageText, false, hasApiKey);

  useEffect(() => {
    // Restore text draft from IDB on initial load
    const restore = async () => {
        try {
            const savedText = await storage.loadTextDraft();
            if (savedText) {
                setInputValue(savedText);
                prevValueLength.current = savedText.length;
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
  
  // Optimized Resize Logic with RAF to prevent forced synchronous reflow
  useLayoutEffect(() => {
    const element = inputRef.current;
    if (!element) return;

    const rafId = requestAnimationFrame(() => {
        const currentLength = inputValue.length;
        const isDeleting = currentLength < prevValueLength.current;
        prevValueLength.current = currentLength;

        // Reset to auto ONLY if deleting or empty to allow shrinkage.
        // Doing this inside RAF batches the DOM write with the subsequent read.
        if (isDeleting || currentLength === 0) {
            element.style.height = 'auto';
        }
        
        const scrollHeight = element.scrollHeight;
        
        const MAX_HEIGHT_PX = 120;
        const SINGLE_LINE_THRESHOLD = 32; 
        
        const shouldBeExpanded = scrollHeight > SINGLE_LINE_THRESHOLD || fileHandling.processedFiles.length > 0;
        if (isExpanded !== shouldBeExpanded) {
            setIsExpanded(shouldBeExpanded);
        }
        
        if (scrollHeight > MAX_HEIGHT_PX) {
            element.style.height = `${MAX_HEIGHT_PX}px`;
            element.style.overflowY = 'auto';
        } else {
            element.style.height = `${scrollHeight}px`;
            element.style.overflowY = 'hidden';
        }
    });

    return () => cancelAnimationFrame(rafId);
  }, [inputValue, fileHandling.processedFiles.length, isExpanded]);

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
    prevValueLength.current = 0;
    fileHandling.clearFiles(); 
    setPreviewFile(null);
    storage.clearAllDrafts().catch(console.error);
  };

  const isProcessingFiles = fileHandling.processedFiles.some(f => f.progress < 100 && !f.error);
  const hasContent = inputValue.trim().length > 0 || fileHandling.processedFiles.length > 0;
  
  const canSubmit = hasContent && !isLoading && !enhancements.isEnhancing && !isProcessingFiles;

  const handleSubmit = (e?: React.FormEvent) => {
    e?.preventDefault();
    console.log('[useMessageForm] handleSubmit Triggered.');

    if (enhancements.isRecording) {
        enhancements.stopRecording();
    }
    
    if (!canSubmit) {
        console.warn('[useMessageForm] Submission blocked.', { hasContent, isLoading, isEnhancing: enhancements.isEnhancing, isProcessingFiles });
        return;
    }

    console.log('[useMessageForm] Submitting...', { inputValue });
    // Pass empty object for options instead of undefined to ensure compatibility
    onSubmit(inputValue, fileHandling.getFilesToSend(), {});
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
        handleSubmit(); 
    }
    if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        handleSubmit();
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
