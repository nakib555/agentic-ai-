
/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { motion } from 'framer-motion';
import { ChevronLeft, ChevronRight } from 'lucide-react';

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
        className={`flex items-center bg-white/80 dark:bg-zinc-900/80 backdrop-blur-md border border-zinc-200/60 dark:border-zinc-800/60 rounded-full shadow-sm p-0.5 select-none transition-colors hover:border-zinc-300 dark:hover:border-zinc-700 ${className}`}
        onClick={(e) => e.stopPropagation()}
    >
        <motion.button
            onClick={handlePrev}
            disabled={activeIndex === 0}
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            className="w-6 h-6 flex items-center justify-center rounded-full text-zinc-500 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-100 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-all disabled:opacity-30 disabled:cursor-not-allowed disabled:hover:bg-transparent"
            aria-label="Previous version"
            title="Previous version"
        >
            <ChevronLeft className="w-3.5 h-3.5" strokeWidth={2.5} />
        </motion.button>
        
        <div className="flex items-center justify-center min-w-[36px] px-1 cursor-default">
            <span className="text-[11px] font-bold text-zinc-800 dark:text-zinc-100 tabular-nums leading-none">
                {activeIndex + 1}
            </span>
            <span className="text-[10px] text-zinc-400 dark:text-zinc-600 mx-0.5 font-medium">/</span>
            <span className="text-[10px] font-medium text-zinc-500 dark:text-zinc-500 tabular-nums leading-none">
                {count}
            </span>
        </div>

        <motion.button
            onClick={handleNext}
            disabled={activeIndex === count - 1}
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            className="w-6 h-6 flex items-center justify-center rounded-full text-zinc-500 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-100 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-all disabled:opacity-30 disabled:cursor-not-allowed disabled:hover:bg-transparent"
            aria-label="Next version"
            title="Next version"
        >
            <ChevronRight className="w-3.5 h-3.5" strokeWidth={2.5} />
        </motion.button>
    </div>
  );
};
