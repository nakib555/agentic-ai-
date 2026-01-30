/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { AnimatePresence, motion as motionTyped } from 'framer-motion';
import { TabButton } from '../UI/TabButton';

const motion = motionTyped as any;

type ImportChatModalProps = {
  isOpen: boolean;
  onClose: () => void;
  onFileUpload: (file: File) => void;
};

// Detailed JSONC example to guide users on the expected format
const jsonStructureExample = `{
  // 🆔 Unique Session Identifier (UUID v4 recommended)
  "id": "chat-550e8400-e29b-41d4-a716-446655440000",
  
  // 🏷️ Conversation Title
  "title": "Agentic Analysis Session",
  
  // 🤖 AI Model Identifier
  "model": "gemini-2.5-pro",
  
  // ⚙️ Agent Mode Flag (Set to true for Agent features, false for Chat)
  "isAgentMode": true,

  // 📅 Creation Timestamp (Unix Milliseconds)
  "createdAt": 1724600000000,
  
  // 💬 Message History
  "messages": [
    {
      "id": "msg-1",
      "role": "user",
      "text": "Research the latest TypeScript features.",
      
      // 🌿 Branching History (Optional)
      "activeVersionIndex": 0, 
      "versions": [ 
        { "text": "Research TypeScript 5.5", "createdAt": 1724600005000 } 
      ]
    },
    {
      "id": "msg-2",
      "role": "model",
      "text": "I will search for the latest TypeScript release notes...",
      
      // 🧠 Response Branching
      "activeResponseIndex": 0,
      "responses": [
        {
          "text": "I will search for the latest TypeScript release notes...\\n\\n[STEP] Final Answer:\\nHere are the key features...",
          "startTime": 1724600010000,
          "endTime": 1724600015000,
          
          // 🛠️ Tool Execution Logs (Agent Mode Only)
          "toolCallEvents": [
            {
               "id": "call_123",
               "call": { "name": "duckduckgoSearch", "args": { "query": "TypeScript 5.5 features" } },
               "result": "TypeScript 5.5 introduces...",
               "startTime": 1724600012000,
               "endTime": 1724600014000
            }
          ]
        }
      ]
    }
  ]
}`;

// Syntax highlighter that supports JSONC (JSON with comments)
const getHighlightedJson = (jsonString: string) => {
  const lines = jsonString.split('\n');
  const html = lines.map(line => {
    // 1. Extract Comment
    const commentMatch = line.match(/(\/\/.*$)/);
    let comment = '';
    let content = line;
    
    if (commentMatch) {
        comment = commentMatch[0];
        content = line.substring(0, commentMatch.index);
    }

    // 2. Highlight JSON Syntax in content part
    let highlighted = content
      .replace(/("(\\u[a-zA-Z0-9]{4}|\\[^u]|[^\\"])*"(\s*:)?)/g, (match) => {
        let cls = 'text-emerald-600 dark:text-emerald-400'; // string value
        if (/:$/.test(match)) {
          cls = 'text-indigo-600 dark:text-indigo-400 font-bold'; // key
        }
        return `<span class="${cls}">${match}</span>`;
      })
      .replace(/\b(true|false|null)\b/g, '<span class="text-rose-500 dark:text-rose-400 font-semibold">$1</span>')
      .replace(/\b(\d{10,})\b/g, '<span class="text-amber-600 dark:text-amber-400">$1</span>');

    // 3. Re-append Comment with styling
    if (comment) {
        highlighted += `<span class="text-slate-400 dark:text-slate-500 italic">${comment}</span>`;
    }
    
    return highlighted;
  }).join('\n');

  return { __html: html };
};


export const ImportChatModal: React.FC<ImportChatModalProps> = ({ isOpen, onClose, onFileUpload }) => {
  const [isCopied, setIsCopied] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [activeTab, setActiveTab] = useState<'import' | 'structure'>('import');

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      onFileUpload(file);
      onClose();
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files?.[0];
    if (file && file.name.endsWith('.json')) {
      onFileUpload(file);
      onClose();
    } else {
      alert('Please upload a valid .json file.');
    }
  };

  const openFileDialog = () => {
    document.getElementById('import-file-input')?.click();
  };

  const handleCopy = () => {
    navigator.clipboard.writeText(jsonStructureExample.trim()).then(() => {
      setIsCopied(true);
      setTimeout(() => setIsCopied(false), 2000);
    });
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
          className="fixed inset-0 bg-black/40 backdrop-blur-none md:backdrop-blur-sm z-[70] flex items-center justify-center p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="import-chat-title"
        >
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 20 }}
            transition={{ type: "spring", stiffness: 300, damping: 25 }}
            className="fixed left-[50%] top-[50%] z-50 flex w-[95vw] max-w-2xl translate-x-[-50%] translate-y-[-50%] flex-col overflow-hidden rounded-2xl border border-slate-200 dark:border-white/10 bg-slate-50 shadow-2xl dark:bg-layer-1 max-h-[85dvh]"
            style={{ height: '600px' }}
            onClick={(e: React.MouseEvent) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 dark:border-white/10 flex-shrink-0 bg-white dark:bg-layer-1">
              <div>
                <h2 id="import-chat-title" className="text-lg font-bold text-gray-800 dark:text-slate-100">
                  Import Chat
                </h2>
                <p className="text-sm text-gray-500 dark:text-slate-400">Restore a conversation from a backup file.</p>
              </div>
              <button
                onClick={onClose}
                className="p-2 rounded-full text-gray-500 dark:text-slate-400 hover:bg-slate-200/50 dark:hover:bg-white/10 transition-colors"
                aria-label="Close"
              >
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-5 h-5">
                  <line x1="18" y1="6" x2="6" y2="18"></line>
                  <line x1="6" y1="6" x2="18" y2="18"></line>
                </svg>
              </button>
            </div>
            
            {/* Tab Bar */}
            <div className="flex items-center px-6 border-b border-slate-200 dark:border-white/10 bg-white dark:bg-layer-1 gap-4">
                <TabButton label="Import File" isActive={activeTab === 'import'} onClick={() => setActiveTab('import')} />
                <TabButton label="JSON Schema" isActive={activeTab === 'structure'} onClick={() => setActiveTab('structure')} />
            </div>

            {/* Content Area */}
            <div className="flex-1 min-h-0 relative bg-slate-50 dark:bg-black/20">
                <AnimatePresence mode="wait">
                    {activeTab === 'import' ? (
                        <motion.div
                            key="import"
                            initial={{ opacity: 0, x: -10 }}
                            animate={{ opacity: 1, x: 0 }}
                            exit={{ opacity: 0, x: 10 }}
                            transition={{ duration: 0.2 }}
                            className="absolute inset-0 p-8 flex flex-col items-center justify-center"
                        >
                             <motion.div 
                                onClick={openFileDialog}
                                onDragOver={handleDragOver}
                                onDragLeave={handleDragLeave}
                                onDrop={handleDrop}
                                animate={isDragging ? { scale: 1.02, borderColor: 'var(--primary-main)', backgroundColor: 'rgba(var(--primary-main), 0.05)' } : { scale: 1, borderColor: 'var(--border-strong)', backgroundColor: 'transparent' }}
                                className={`group w-full h-full flex flex-col items-center justify-center p-10 border-2 border-dashed rounded-2xl transition-all duration-300 cursor-pointer overflow-hidden
                                  ${isDragging 
                                      ? 'border-indigo-500 bg-indigo-50/50 dark:bg-indigo-500/10' 
                                      : 'border-slate-300 dark:border-slate-600 bg-white dark:bg-white/5 hover:bg-slate-50 dark:hover:bg-white/10 hover:border-indigo-400 dark:hover:border-indigo-400 hover:shadow-lg'
                                  }`}
                              >
                                <motion.div 
                                  className={`p-5 rounded-full mb-5 transition-colors ${isDragging ? 'bg-indigo-100 text-indigo-600 dark:bg-indigo-500/20 dark:text-indigo-300' : 'bg-slate-100 dark:bg-white/10 text-slate-400 dark:text-slate-500 group-hover:text-indigo-500 group-hover:bg-indigo-50 dark:group-hover:bg-indigo-500/20'}`}
                                  animate={isDragging ? { y: -5 } : { y: 0 }}
                                >
                                  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-12 h-12">
                                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 16.5V9.75m0 0 3 3m-3-3-3 3M6.75 19.5a4.5 4.5 0 0 1-1.41-8.775 5.25 5.25 0 0 1 10.233-2.33 3 3 0 0 1 3.758 3.848A3.752 3.752 0 0 1 18 19.5H6.75Z" />
                                  </svg>
                                </motion.div>
                                <p className="text-lg font-bold text-gray-700 dark:text-slate-200 mb-1 text-center">
                                  {isDragging ? "Drop JSON file here" : "Drag & Drop or Click to Upload"}
                                </p>
                                <p className="text-sm text-gray-500 dark:text-slate-400 text-center max-w-[200px]">
                                  Upload your exported chat history file (.json)
                                </p>
                              </motion.div>
                              <input id="import-file-input" type="file" accept=".json" onChange={handleFileChange} className="hidden" />
                        </motion.div>
                    ) : (
                        <motion.div
                            key="structure"
                            initial={{ opacity: 0, x: 10 }}
                            animate={{ opacity: 1, x: 0 }}
                            exit={{ opacity: 0, x: -10 }}
                            transition={{ duration: 0.2 }}
                            className="absolute inset-0 flex flex-col p-6 overflow-hidden"
                        >
                             <div className="flex items-center gap-2 mb-4">
                                <div className="w-1 h-4 bg-indigo-500 rounded-full"></div>
                                <h3 className="text-sm font-bold text-gray-700 dark:text-slate-200 uppercase tracking-wide">Expected Data Format</h3>
                            </div>
                            
                            <div className="flex-1 min-h-0 rounded-xl bg-slate-200/50 dark:bg-black/30 border border-slate-300/50 dark:border-white/5 shadow-inner flex flex-col overflow-hidden">
                                <div className="px-4 py-2.5 bg-slate-200 dark:bg-white/5 border-b border-slate-300/50 dark:border-white/5 flex justify-between items-center z-10 backdrop-blur-sm shrink-0">
                                  <p className="text-xs font-semibold text-slate-500 dark:text-gray-400 font-mono flex items-center gap-2">
                                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-3.5 h-3.5"><path fillRule="evenodd" d="M4.5 2A1.5 1.5 0 0 0 3 3.5v13A1.5 1.5 0 0 0 4.5 18h11a1.5 1.5 0 0 0 1.5-1.5V7.621a1.5 1.5 0 0 0-.44-1.06l-4.12-4.122A1.5 1.5 0 0 0 11.378 2H4.5Zm2.25 8.5a.75.75 0 0 0 0 1.5h6.5a.75.75 0 0 0 0-1.5h-6.5Zm0 3a.75.75 0 0 0 0 1.5h6.5a.75.75 0 0 0 0-1.5h-6.5Z" clipRule="evenodd" /></svg>
                                    example-chat.json
                                  </p>
                                  <button
                                    onClick={handleCopy}
                                    className="group flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium text-slate-600 hover:bg-white dark:text-slate-300 dark:hover:bg-white/10 hover:shadow-sm transition-all border border-transparent hover:border-slate-300 dark:hover:border-white/10"
                                  >
                                    <AnimatePresence mode="wait" initial={false}>
                                      {isCopied ? (
                                          <motion.span key="check" initial={{ opacity: 0, scale: 0.5 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.5 }} className="text-green-600 dark:text-green-400 flex items-center gap-1">
                                              <svg width="20" height="20" viewBox="0 0 20 20" fill="currentColor" xmlns="http://www.w3.org/2000/svg" className="w-3.5 h-3.5"><path d="M15.1883 5.10908C15.3699 4.96398 15.6346 4.96153 15.8202 5.11592C16.0056 5.27067 16.0504 5.53125 15.9403 5.73605L15.8836 5.82003L8.38354 14.8202C8.29361 14.9279 8.16242 14.9925 8.02221 14.9989C7.88203 15.0051 7.74545 14.9526 7.64622 14.8534L4.14617 11.3533L4.08172 11.2752C3.95384 11.0811 3.97542 10.817 4.14617 10.6463C4.31693 10.4755 4.58105 10.4539 4.77509 10.5818L4.85321 10.6463L7.96556 13.7586L15.1161 5.1794L15.1883 5.10908Z"></path></svg>
                                              Copied
                                          </motion.span>
                                      ) : (
                                          <motion.span key="copy" initial={{ opacity: 0, scale: 0.5 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.5 }} className="flex items-center gap-1">
                                              <svg width="20" height="20" viewBox="0 0 20 20" fill="currentColor" xmlns="http://www.w3.org/2000/svg" className="w-3.5 h-3.5 group-hover:text-indigo-500 transition-colors"><path d="M10 1.5C11.1097 1.5 12.0758 2.10424 12.5947 3H14.5C15.3284 3 16 3.67157 16 4.5V16.5C16 17.3284 15.3284 18 14.5 18H5.5C4.67157 18 4 17.3284 4 16.5V4.5C4 3.67157 4.67157 3 5.5 3H7.40527C7.92423 2.10424 8.89028 1.5 10 1.5ZM5.5 4C5.22386 4 5 4.22386 5 4.5V16.5C5 16.7761 5.22386 17 5.5 17H14.5C14.7761 17 15 16.7761 15 16.5V4.5C15 4.22386 14.7761 4 14.5 4H12.958C12.9853 4.16263 13 4.32961 13 4.5V5.5C13 5.77614 12.7761 6 12.5 6H7.5C7.22386 6 7 5.77614 7 5.5V4.5C7 4.32961 7.0147 4.16263 7.04199 4H5.5ZM12.54 13.3037C12.6486 13.05 12.9425 12.9317 13.1963 13.04C13.45 13.1486 13.5683 13.4425 13.46 13.6963C13.1651 14.3853 12.589 15 11.7998 15C11.3132 14.9999 10.908 14.7663 10.5996 14.4258C10.2913 14.7661 9.88667 14.9999 9.40039 15C8.91365 15 8.50769 14.7665 8.19922 14.4258C7.89083 14.7661 7.48636 15 7 15C6.72386 15 6.5 14.7761 6.5 14.5C6.5 14.2239 6.72386 14 7 14C7.21245 14 7.51918 13.8199 7.74023 13.3037L7.77441 13.2373C7.86451 13.0913 8.02513 13 8.2002 13C8.40022 13.0001 8.58145 13.1198 8.66016 13.3037C8.88121 13.8198 9.18796 14 9.40039 14C9.61284 13.9998 9.9197 13.8197 10.1406 13.3037L10.1748 13.2373C10.2649 13.0915 10.4248 13.0001 10.5996 9C10.7997 9 10.9808 9.11975 11.0596 9.30371C11.2806 9.8198 11.5874 9.99989 11.7998 10C12.0122 10 12.319 9.81985 12.54 9.30371ZM10 2.5C8.89543 2.5 8 3.39543 8 4.5V5H12V4.5C12 3.39543 11.1046 2.5 10 2.5Z"></path></svg>
                                              Copy Example
                                          </motion.span>
                                      )}
                                    </AnimatePresence>
                                  </button>
                                </div>
                                <div className="flex-1 overflow-auto custom-scrollbar bg-slate-50 dark:bg-black/20">
                                    <pre className="p-4 text-[11px] font-mono leading-relaxed text-slate-600 dark:text-slate-400 whitespace-pre overflow-x-auto">
                                      <code dangerouslySetInnerHTML={getHighlightedJson(jsonStructureExample.trim())} />
                                    </pre>
                                </div>
                            </div>
                        </motion.div>
                    )}
                </AnimatePresence>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};