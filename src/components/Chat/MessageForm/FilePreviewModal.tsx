
/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { AnimatePresence, motion as motionTyped } from 'framer-motion';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { useSyntaxTheme } from '../../../hooks/useSyntaxTheme';

const motion = motionTyped as any;

type FilePreviewModalProps = {
  file: File;
  isOpen: boolean;
  onClose: () => void;
};

// Static styles
const CUSTOM_STYLE = { 
    margin: 0, 
    padding: '1.5rem', 
    height: '100%', 
    background: 'transparent' 
};

export const FilePreviewModal: React.FC<FilePreviewModalProps> = ({ file, isOpen, onClose }) => {
  const [content, setContent] = useState<string | null>(null);
  const [fileType, setFileType] = useState<'image' | 'text' | 'pdf' | 'other'>('other');
  const [language, setLanguage] = useState('text');
  const syntaxStyle = useSyntaxTheme();

  useEffect(() => {
    if (!file) return;

    if (file.type.startsWith('image/')) {
      setFileType('image');
      const url = URL.createObjectURL(file);
      setContent(url);
      return () => URL.revokeObjectURL(url);
    } 
    
    if (file.type === 'application/pdf') {
        setFileType('pdf');
        const url = URL.createObjectURL(file);
        setContent(url);
        return () => URL.revokeObjectURL(url);
    }

    // Text-based files
    if (
      file.type.startsWith('text/') || 
      file.name.match(/\.(json|js|jsx|ts|tsx|css|html|md|py|rb|java|c|cpp|h|txt|csv|xml|yaml|yml|log|env|ini|conf)$/i)
    ) {
      setFileType('text');
      
      const ext = file.name.split('.').pop()?.toLowerCase();
      let detectedLang = 'text';
      switch(ext) {
          case 'js': case 'jsx': detectedLang = 'javascript'; break;
          case 'ts': case 'tsx': detectedLang = 'typescript'; break;
          case 'py': detectedLang = 'python'; break;
          case 'rb': detectedLang = 'ruby'; break;
          case 'java': detectedLang = 'java'; break;
          case 'c': case 'h': detectedLang = 'c'; break;
          case 'cpp': detectedLang = 'cpp'; break;
          case 'css': detectedLang = 'css'; break;
          case 'html': case 'xml': case 'svg': detectedLang = 'markup'; break; // Map HTML to markup
          case 'json': detectedLang = 'json'; break;
          case 'md': detectedLang = 'markdown'; break;
          case 'sql': detectedLang = 'sql'; break;
          case 'sh': case 'bash': detectedLang = 'bash'; break;
          case 'yaml': case 'yml': detectedLang = 'yaml'; break;
          default: detectedLang = 'text';
      }
      setLanguage(detectedLang);

      const reader = new FileReader();
      reader.onload = (e) => {
          const result = e.target?.result;
          if (typeof result === 'string') setContent(result);
      };
      reader.readAsText(file);
      return;
    }

    setFileType('other');
  }, [file]);

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
          className="fixed inset-0 bg-black/60 backdrop-blur-none md:backdrop-blur-sm z-[150] flex items-center justify-center p-4 sm:p-8"
        >
          <motion.div
            initial={{ scale: 0.95, opacity: 0, y: 20 }}
            animate={{ scale: 1, opacity: 1, y: 0 }}
            exit={{ scale: 0.95, opacity: 0, y: 20 }}
            onClick={(e: React.MouseEvent) => e.stopPropagation()}
            className="fixed left-[50%] top-[50%] z-50 flex w-full max-w-4xl translate-x-[-50%] translate-y-[-50%] flex-col overflow-hidden rounded-2xl bg-white shadow-2xl dark:bg-[#121212] max-h-[85dvh]"
          >
            {/* Header */}
            <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200 dark:border-white/10 bg-gray-50 dark:bg-[#18181b]">
              <div className="flex items-center gap-3 overflow-hidden">
                 <div className="p-1.5 bg-white dark:bg-white/10 rounded-lg shadow-sm">
                    {/* Simplified File Icon */}
                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-5 h-5 text-indigo-500">
                        <path fillRule="evenodd" d="M5.625 1.5H9a3.75 3.75 0 0 1 3.75 3.75v1.875c0 1.036.84 1.875 1.875 1.875H16.5a3.75 3.75 0 0 1 3.75 3.75v7.875c0 1.035-.84 1.875-1.875 1.875H5.625a1.875 1.875 0 0 1-1.875-1.875V3.375c0-1.036.84-1.875 1.875-1.875ZM12.75 12a.75.75 0 0 0-1.5 0v2.25H9a.75.75 0 0 0 0 1.5h2.25V18a.75.75 0 0 0 1.5 0v-2.25H15a.75.75 0 0 0 0-1.5h-2.25V12Z" clipRule="evenodd" />
                        <path d="M14.25 5.25a5.23 5.23 0 0 0-1.279-3.434 9.768 9.768 0 0 1 6.963 6.963A5.23 5.23 0 0 0 16.5 7.5h-1.875a.375.375 0 0 1-.375-.375V5.25Z" />
                    </svg>
                 </div>
                 <div className="flex flex-col min-w-0">
                    <span className="font-semibold text-sm text-gray-900 dark:text-gray-100 truncate">{file.name}</span>
                    <span className="text-xs text-gray-500 dark:text-gray-400">
                        {(file.size / 1024).toFixed(1)} KB • {file.type || 'Unknown Type'}
                    </span>
                 </div>
              </div>
              <button onClick={onClose} className="p-2 rounded-full hover:bg-gray-200 dark:hover:bg-white/10 text-gray-500 dark:text-gray-400 transition-colors">
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-5 h-5"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
              </button>
            </div>

            {/* Content */}
            <div className="flex-1 overflow-auto bg-gray-100 dark:bg-black/50 p-4 flex items-center justify-center min-h-[300px]">
                {fileType === 'image' && content && (
                    <img src={content} alt={file.name} className="max-w-full max-h-full object-contain rounded-lg shadow-md" />
                )}
                
                {fileType === 'pdf' && content && (
                    <iframe src={content} title={file.name} className="w-full h-full min-h-[600px] rounded-lg border-none bg-white shadow-sm" />
                )}

                {fileType === 'text' && content && (
                    <div className="w-full h-full bg-white dark:bg-[#1e1e1e] rounded-lg shadow-sm overflow-hidden text-sm border border-gray-200 dark:border-white/5">
                        <SyntaxHighlighter
                            language={language}
                            style={syntaxStyle}
                            customStyle={CUSTOM_STYLE}
                            wrapLongLines={true}
                        >
                            {content}
                        </SyntaxHighlighter>
                    </div>
                )}

                {fileType === 'other' && (
                    <div className="text-center text-gray-500 dark:text-gray-400">
                        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-16 h-16 mx-auto mb-4 opacity-50">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 0 0-3.375-3.375h-1.5A1.125 1.125 0 0 1 13.5 7.125v-1.5a3.375 3.375 0 0 0-3.375-3.375H8.25m2.25 0H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 0 0-9-9Z" />
                        </svg>
                        <p>No preview available for this file type.</p>
                    </div>
                )}
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};
