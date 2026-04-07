
/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { motion as motionTyped, AnimatePresence } from 'framer-motion';

const motion = motionTyped as any;

type CodeExecutionResultProps = {
  outputId: string;
  htmlOutput: string;
  textOutput: string;
};

const CopyIcon = () => (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-3.5 h-3.5">
        <rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect>
        <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path>
    </svg>
);

const CheckIcon = () => (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-3.5 h-3.5 text-green-400">
        <polyline points="20 6 9 17 4 12"></polyline>
    </svg>
);

const TerminalIcon = () => (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4">
        <polyline points="4 17 10 11 4 5"></polyline>
        <line x1="12" y1="19" x2="20" y2="19"></line>
    </svg>
);

const EyeIcon = () => (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4">
        <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path>
        <circle cx="12" cy="12" r="3"></circle>
    </svg>
);

export const CodeExecutionResult: React.FC<CodeExecutionResultProps> = ({ outputId, htmlOutput, textOutput }) => {
  const [activeTab, setActiveTab] = useState<'visual' | 'text'>('visual');
  const [isCopied, setIsCopied] = useState(false);

  // Auto-select text tab if the HTML output is just the fallback wrapper for text
  // (Heuristic: simple text outputs often have a specific structure in backend/tools/codeExecutor.ts)
  const isPureText = !htmlOutput || htmlOutput.includes('<span style="color: #666; font-style: italic;">No output</span>') || textOutput.length > 50;

  const handleCopy = () => {
    if (!textOutput) return;
    navigator.clipboard.writeText(textOutput).then(() => {
        setIsCopied(true);
        setTimeout(() => setIsCopied(false), 2000);
    });
  };

  return (
    <div className="my-6 rounded-xl overflow-hidden border border-gray-200 dark:border-white/10 bg-white dark:bg-[#09090b] shadow-sm">
      {/* Terminal Header */}
      <div className="flex items-center justify-between px-4 py-3 bg-gray-50/80 dark:bg-[#18181b] border-b border-gray-200 dark:border-white/5">
        <div className="flex items-center gap-4">
            {/* Window Controls */}
            <div className="flex gap-1.5">
                <div className="w-3 h-3 rounded-full bg-[#FF5F57] border border-black/5 dark:border-transparent"></div>
                <div className="w-3 h-3 rounded-full bg-[#FEBC2E] border border-black/5 dark:border-transparent"></div>
                <div className="w-3 h-3 rounded-full bg-[#28C840] border border-black/5 dark:border-transparent"></div>
            </div>
            
            {/* Tabs */}
            <div className="flex p-0.5 bg-gray-200/50 dark:bg-white/5 rounded-lg ml-2" role="tablist" aria-label="Code Execution Views">
                <button
                    id={`tab-visual-${outputId}`}
                    role="tab"
                    aria-selected={activeTab === 'visual'}
                    aria-controls={`panel-visual-${outputId}`}
                    onClick={() => setActiveTab('visual')}
                    className={`flex items-center gap-1.5 px-3 py-1 rounded-md text-xs font-medium transition-all ${activeTab === 'visual' ? 'bg-white dark:bg-[#2a2a2a] text-indigo-600 dark:text-indigo-300 shadow-sm' : 'text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200'}`}
                >
                    <EyeIcon />
                    Preview
                </button>
                <button
                    id={`tab-text-${outputId}`}
                    role="tab"
                    aria-selected={activeTab === 'text'}
                    aria-controls={`panel-text-${outputId}`}
                    onClick={() => setActiveTab('text')}
                    className={`flex items-center gap-1.5 px-3 py-1 rounded-md text-xs font-medium transition-all ${activeTab === 'text' ? 'bg-white dark:bg-[#2a2a2a] text-indigo-600 dark:text-indigo-300 shadow-sm' : 'text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200'}`}
                >
                    <TerminalIcon />
                    Console
                </button>
            </div>
        </div>

        {/* Actions */}
        {activeTab === 'text' && (
            <button 
                onClick={handleCopy}
                className="flex items-center gap-1.5 px-2 py-1 text-xs font-medium text-slate-500 hover:text-indigo-600 dark:text-slate-400 dark:hover:text-indigo-400 bg-gray-100 hover:bg-indigo-50 dark:bg-white/5 dark:hover:bg-indigo-500/10 rounded-md transition-colors"
            >
                {isCopied ? <CheckIcon /> : <CopyIcon />}
                {isCopied ? 'Copied' : 'Copy'}
            </button>
        )}
      </div>

      {/* Content Area */}
      <div className="relative bg-white dark:bg-[#0c0c0c] min-h-[150px]">
        <AnimatePresence initial={false} mode="wait">
          <motion.div
            key={activeTab}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.15 }}
            className="h-full"
          >
            {activeTab === 'visual' ? (
              <div id={`panel-visual-${outputId}`} role="tabpanel" aria-labelledby={`tab-visual-${outputId}`} className="w-full h-full bg-white relative">
                 {/* Checkerboard background for transparency simulation */}
                <div className="absolute inset-0 opacity-5 pointer-events-none" 
                     style={{ backgroundImage: 'radial-gradient(#000 1px, transparent 1px)', backgroundSize: '20px 20px' }}>
                </div>
                <iframe
                  srcDoc={htmlOutput}
                  className="w-full h-96 border-none"
                  sandbox="allow-scripts allow-forms allow-modals allow-popups"
                  title="Code Execution Visual Output"
                />
              </div>
            ) : (
              <div id={`panel-text-${outputId}`} role="tabpanel" aria-labelledby={`tab-text-${outputId}`} className="max-h-96 overflow-y-auto custom-scrollbar bg-[#0c0c0c] text-gray-300 p-1">
                {/* Terminal Window content */}
                <pre className="p-4 font-mono text-[13px] leading-relaxed whitespace-pre-wrap break-all">
                    <span className="text-green-500 select-none mr-2">➜</span>
                    <span className="text-blue-400 select-none mr-2">~</span>
                    <span className="text-slate-500 select-none">node output.js</span>
                    <br/><br/>
                    <code>{textOutput || <span className="text-slate-600 italic">No console output generated.</span>}</code>
                </pre>
              </div>
            )}
          </motion.div>
        </AnimatePresence>
      </div>
      
      {/* Footer Status */}
      <div className="px-4 py-1.5 bg-gray-50 dark:bg-[#18181b] border-t border-gray-200 dark:border-white/5 flex items-center justify-between text-[10px] uppercase tracking-wider font-semibold text-slate-400">
         <div className="flex items-center gap-2">
             <div className={`w-1.5 h-1.5 rounded-full ${textOutput && textOutput.toLowerCase().includes('error') ? 'bg-red-500' : 'bg-green-500'}`}></div>
             <span>{textOutput && textOutput.toLowerCase().includes('error') ? 'Process Failed' : 'Process Finished'}</span>
         </div>
         <span>Output ID: {outputId.substring(0, 8)}</span>
      </div>
    </div>
  );
};
