
/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { motion } from 'framer-motion';

type BranchSwitcherProps = {
  count: number;
  activeIndex: number;
  onChange: (index: number) => void;
  className?: string;
};

export const BranchSwitcher: React.FC<BranchSwitcherProps> = ({ count, activeIndex, onChange, className = '' }) => {
  if (count <= 1) {
    return null;
  }

  const handlePrev = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (activeIndex > 0) {
      onChange(activeIndex - 1);
    }
  };

  const handleNext = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (activeIndex < count - 1) {
      onChange(activeIndex + 1);
    }
  };

  return (
    <div 
        className={`flex items-center gap-1.5 p-1 pr-1.5 bg-white/60 dark:bg-black/20 backdrop-blur-md border border-slate-200 dark:border-white/10 rounded-full shadow-sm select-none ${className}`}
        onClick={(e) => e.stopPropagation()}
    >
        <motion.button
            onClick={handlePrev}
            disabled={activeIndex === 0}
            whileTap={{ scale: 0.9 }}
            className="w-6 h-6 flex items-center justify-center rounded-full bg-white dark:bg-white/10 border border-slate-100 dark:border-white/5 shadow-sm text-slate-500 dark:text-slate-400 hover:text-indigo-600 dark:hover:text-indigo-400 hover:border-indigo-100 dark:hover:border-indigo-500/30 transition-colors disabled:opacity-40 disabled:cursor-not-allowed disabled:shadow-none"
            aria-label="Previous version"
            title="Previous version"
        >
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-3.5 h-3.5">
                <path fillRule="evenodd" d="M12.79 5.23a.75.75 0 01-.02 1.06L8.832 10l3.938 3.71a.75.75 0 11-1.04 1.08l-4.5-4.25a.75.75 0 010-1.08l4.5-4.25a.75.75 0 011.06.02z" clipRule="evenodd" />
            </svg>
        </motion.button>
        
        <span className="text-[10px] font-bold text-slate-600 dark:text-slate-300 tabular-nums tracking-widest min-w-[24px] text-center">
            {activeIndex + 1}<span className="text-slate-300 dark:text-slate-600 mx-0.5">/</span>{count}
        </span>

        <motion.button
            onClick={handleNext}
            disabled={activeIndex === count - 1}
            whileTap={{ scale: 0.9 }}
            className="w-6 h-6 flex items-center justify-center rounded-full bg-white dark:bg-white/10 border border-slate-100 dark:border-white/5 shadow-sm text-slate-500 dark:text-slate-400 hover:text-indigo-600 dark:hover:text-indigo-400 hover:border-indigo-100 dark:hover:border-indigo-500/30 transition-colors disabled:opacity-40 disabled:cursor-not-allowed disabled:shadow-none"
            aria-label="Next version"
            title="Next version"
        >
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-3.5 h-3.5">
                <path fillRule="evenodd" d="M7.21 14.77a.75.75 0 01.02-1.06L11.168 10 7.23 6.29a.75.75 0 111.04-1.08l4.5 4.25a.75.75 0 010 1.08l-4.5 4.25a.75.75 0 01-1.06-.02z" clipRule="evenodd" />
            </svg>
        </motion.button>
    </div>
  );
};
