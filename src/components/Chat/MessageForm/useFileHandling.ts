/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

// This hook manages all logic related to file attachments for the message form.
// It includes processing, progress tracking, removal, and draft saving/restoration.

import React, { useState, useRef, useEffect, useCallback, useImperativeHandle } from 'react';
import { fileToBase64WithProgress, base64ToFile } from '../../../utils/fileUtils';
import { type MessageFormHandle, type SavedFile, type ProcessedFile, type FileWithEditKey } from './types';
import { storage } from '../../../utils/storage';

export const useFileHandling = (ref: React.ForwardedRef<MessageFormHandle>) => {
  const [processedFiles, setProcessedFiles] = useState<ProcessedFile[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const folderInputRef = useRef<HTMLInputElement>(null);
  const isHydrated = useRef(false);

  const processAndSetFiles = useCallback((filesToProcess: FileWithEditKey[]) => {
    const newProcessedFiles: ProcessedFile[] = filesToProcess.map(file => ({
      id: `${file.name}-${file.size}-${Date.now()}-${Math.random()}`,
      file,
      progress: 0,
      base64Data: null,
      error: null,
    }));

    setProcessedFiles(prev => [...prev, ...newProcessedFiles]);

    newProcessedFiles.forEach(pf => {
      fileToBase64WithProgress(pf.file, (progress) => {
        setProcessedFiles(prev => prev.map(f => f.id === pf.id ? { ...f, progress } : f));
      })
      .then(base64Data => {
        setProcessedFiles(prev => prev.map(f => f.id === pf.id ? { ...f, base64Data, progress: 100 } : f));
      })
      .catch(error => {
        console.error("File processing error:", error);
        setProcessedFiles(prev => prev.map(f => f.id === pf.id ? { ...f, error: error.message || 'Failed to read file' } : f));
      });
    });
  }, []);

  useImperativeHandle(ref, () => ({
    attachFiles: (incomingFiles: File[]) => {
      if (!incomingFiles || incomingFiles.length === 0) return;
      
      const newFilesToAdd: FileWithEditKey[] = [];
      const existingEditKeys = new Set(processedFiles.map(pf => pf.file._editKey).filter(Boolean));

      for (const file of incomingFiles) {
        const editableFile = file as FileWithEditKey;
        if (editableFile._editKey) {
          if (existingEditKeys.has(editableFile._editKey)) {
            alert('This image is already attached for editing.');
            continue;
          }
        }
        newFilesToAdd.push(editableFile);
      }
      
      if (newFilesToAdd.length > 0) {
        processAndSetFiles(newFilesToAdd);
      }
    }
  }));

  // Restore file drafts from IDB on initial load
  useEffect(() => {
    const restore = async () => {
        try {
            const savedFiles = await storage.loadFileDrafts();
            if (Array.isArray(savedFiles) && savedFiles.length > 0) {
                const restoredFiles: ProcessedFile[] = savedFiles.map(sf => {
                    const file = base64ToFile(sf.data, sf.name, sf.mimeType);
                    return {
                        id: `${file.name}-${file.size}-${Date.now()}`,
                        file, 
                        progress: 100, 
                        base64Data: sf.data, 
                        error: null,
                    };
                });
                setProcessedFiles(restoredFiles);
            }
        } catch (error) {
            console.error("Failed to restore saved files:", error);
        } finally {
            isHydrated.current = true;
        }
    };
    restore();
  }, []);

  // Save file drafts to IDB
  useEffect(() => {
    if (!isHydrated.current) return;

    const save = async () => {
        try {
            const filesToSave: SavedFile[] = processedFiles
                .filter(pf => pf.base64Data)
                .map(pf => ({ name: pf.file.name, mimeType: pf.file.type, data: pf.base64Data! }));
            
            await storage.saveFileDrafts(filesToSave);
        } catch (e) {
            console.error("Error saving file drafts:", e);
        }
    };

    // Debounce saves slightly
    const timer = setTimeout(save, 500);
    return () => clearTimeout(timer);
  }, [processedFiles]);

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    if (event.target.files) processAndSetFiles(Array.from(event.target.files));
    event.target.value = ''; // Reset input to allow re-selecting the same file
  };

  const handleRemoveFile = (id: string) => {
    setProcessedFiles(prev => prev.filter((pf) => pf.id !== id));
  };
  
  const getFilesToSend = (): File[] => {
    return processedFiles
      .filter(f => f.base64Data && !f.error)
      .map(f => base64ToFile(f.base64Data!, f.file.name, f.file.type));
  };
  
  const clearFiles = () => {
    setProcessedFiles([]);
    storage.clearFileDrafts().catch(console.error);
  };

  return {
    processedFiles,
    fileInputRef,
    folderInputRef,
    processAndSetFiles,
    handleFileChange,
    handleRemoveFile,
    getFilesToSend,
    clearFiles,
  };
};