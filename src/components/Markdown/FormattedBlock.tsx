
/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

// FormattedBlock.tsx
import React, { useState } from 'react';
import { motion as motionTyped, AnimatePresence } from 'framer-motion';
import { ManualCodeRenderer } from './ManualCodeRenderer';
import { MarkdownComponents } from './markdownComponents';

const motion = motionTyped as any;

type FormattedBlockProps = {
  content: string;
  isStreaming: boolean;
};

export const FormattedBlock: React.FC<FormattedBlockProps> = ({ content, isStreaming }) => {
  const [isRawVisible, setIsRawVisible] = useState(false);
  const cleanContent = content.trim();

  return (
    <div className="my-4 rounded-lg text-sm overflow-hidden shadow-lg dark:shadow-2xl dark:shadow-black/30 border border-slate-200 dark:border-slate-700">
      <div className="flex justify-between items-center px-4 py-2 bg-slate-100 dark:bg-[#171717] border-b border-slate-200 dark:border-[rgba(255,255,255,0.08)]">
        <span className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-gray-400">
          Formatted Content
        </span>
        <button
          onClick={() => setIsRawVisible(!isRawVisible)}
          aria-label={isRawVisible ? 'Show rendered view' : 'Show raw source'}
          className="flex items-center space-x-2 p-1 rounded-md text-slate-500 hover:text-slate-800 dark:text-gray-400 dark:hover:text-white transition-colors duration-150 active:scale-95 focus:outline-none"
        >
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16" fill="currentColor" className="w-4 h-4"><path fillRule="evenodd" d="M4.22 5.22a.75.75 0 0 1 1.06 0L8 7.94l2.72-2.72a.75.75 0 1 1 1.06 1.06L9.06 9l2.72 2.72a.75.75 0 1 1-1.06 1.06L8 10.06l-2.72 2.72a.75.75 0 0 1-1.06-1.06L6.94 9 4.22 6.28a.75.75 0 0 1 0-1.06Z" clipRule="evenodd" /></svg>
          <span className="text-xs font-medium uppercase tracking-wider">
            {isRawVisible ? 'Formatted' : 'Raw'}
          </span>
        </button>
      </div>
      <div className="relative">
        <AnimatePresence initial={false} mode="wait">
            <motion.div
                key={isRawVisible ? 'raw' : 'formatted'}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.2 }}
            >
                {isRawVisible ? (
                    <pre className="p-4 bg-slate-50 dark:bg-black/20 text-xs font-['Fira_Code',_monospace] text-slate-700 dark:text-slate-300 whitespace-pre-wrap break-all">
                        {cleanContent}
                    </pre>
                ) : (
                    <div className="p-4 bg-white dark:bg-[#121212]">
                        <ManualCodeRenderer text={cleanContent} components={MarkdownComponents} isStreaming={isStreaming} />
                    </div>
                )}
            </motion.div>
        </AnimatePresence>
      </div>
    </div>
  );
};
