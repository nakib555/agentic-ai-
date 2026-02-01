
/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { motion } from 'framer-motion';
import { ChevronLeft, ChevronRight } from 'lucide-react';

type ResponsePaginatorProps = {
  count: number;
  activeIndex: number;
  onChange: (index: number) => void;
};

export const ResponsePaginator: React.FC<ResponsePaginatorProps> = ({ count, activeIndex, onChange }) => {
  if (count <= 1) {
    return null; // Don't show paginator for a single response
  }

  const handlePrev = () => {
    if (activeIndex > 0) {
      onChange(activeIndex - 1);
    }
  };

  const handleNext = () => {
    if (activeIndex < count - 1) {
      onChange(activeIndex + 1);
    }
  };

  return (
    <div className="flex items-center gap-0.5 p-1 bg-white/90 dark:bg-zinc-900/90 backdrop-blur-md border border-zinc-200/80 dark:border-zinc-700/50 rounded-full shadow-sm shadow-zinc-200/20 dark:shadow-black/20 select-none mr-2">
        <motion.button
            onClick={handlePrev}
            disabled={activeIndex === 0}
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            className="w-6 h-6 flex items-center justify-center rounded-full text-zinc-500 dark:text-zinc-400 hover:text-indigo-600 dark:hover:text-indigo-400 hover:bg-indigo-50 dark:hover:bg-indigo-500/10 transition-colors disabled:opacity-30 disabled:cursor-not-allowed disabled:hover:bg-transparent disabled:hover:text-zinc-500"
            aria-label="Previous version"
            title="Previous version"
        >
             <ChevronLeft className="w-3.5 h-3.5" strokeWidth={2.5} />
        </motion.button>
        
        <div className="flex items-center justify-center min-w-[32px] px-0.5 cursor-default">
            <span className="text-[11px] font-bold text-zinc-700 dark:text-zinc-200 tabular-nums leading-none">
                {activeIndex + 1}
            </span>
            <span className="text-[9px] text-zinc-400 dark:text-zinc-600 mx-0.5 font-semibold">/</span>
            <span className="text-[10px] font-medium text-zinc-500 dark:text-zinc-500 tabular-nums leading-none">
                {count}
            </span>
        </div>

        <motion.button
            onClick={handleNext}
            disabled={activeIndex === count - 1}
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            className="w-6 h-6 flex items-center justify-center rounded-full text-zinc-500 dark:text-zinc-400 hover:text-indigo-600 dark:hover:text-indigo-400 hover:bg-indigo-50 dark:hover:bg-indigo-500/10 transition-colors disabled:opacity-30 disabled:cursor-not-allowed disabled:hover:bg-transparent disabled:hover:text-zinc-500"
            aria-label="Next version"
            title="Next version"
        >
             <ChevronRight className="w-3.5 h-3.5" strokeWidth={2.5} />
        </motion.button>
    </div>
  );
};
