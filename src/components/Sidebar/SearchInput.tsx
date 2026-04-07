
/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { forwardRef, useState } from 'react';
import { motion as motionTyped } from 'framer-motion';
const motion = motionTyped as any;

type Variants = any;

const searchContainerVariants: Variants = {
    open: {
        height: 'auto',
        opacity: 1,
        marginBottom: '1rem',
        transition: { duration: 0.3, ease: [0.4, 0, 0.2, 1] },
    },
    collapsed: {
        height: 0,
        opacity: 0,
        marginBottom: 0,
        transition: { duration: 0.3, ease: [0.4, 0, 0.2, 1] },
    }
};

type SearchInputProps = {
  isCollapsed: boolean;
  isDesktop: boolean;
  searchQuery: string;
  setSearchQuery: (query: string) => void;
};

export const SearchInput = forwardRef<HTMLInputElement, SearchInputProps>(
  ({ isCollapsed, isDesktop, searchQuery, setSearchQuery }, ref) => {
    const [isFocused, setIsFocused] = useState(false);

    return (
      <motion.div 
          className="relative overflow-hidden px-1"
          initial={false}
          variants={searchContainerVariants}
          // Focus Mode: Prevent collapsing if the user is actively interacting with the search
          animate={isDesktop && isCollapsed && !isFocused ? 'collapsed' : 'open'}
      >
          <div className="relative group">
            <input 
              ref={ref}
              type="text" 
              placeholder="Search..." 
              aria-label="Search chat history"
              className={`
                w-full pl-9 pr-14 py-2.5 rounded-xl text-sm transition-all duration-200 shadow-sm outline-none
                ${isFocused
                  ? 'bg-white dark:bg-black/40 border-indigo-500 ring-2 ring-indigo-500/20 text-slate-900 dark:text-slate-100'
                  : 'bg-white/60 dark:bg-white/5 border-gray-200 dark:border-white/10 text-slate-700 dark:text-slate-200 hover:border-gray-300 dark:hover:border-white/20'
                }
                border placeholder:text-slate-400 dark:placeholder:text-slate-500
              `}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onFocus={() => setIsFocused(true)}
              onBlur={() => setIsFocused(false)}
            />
            <div className={`absolute inset-y-0 left-0 flex items-center pl-3 pointer-events-none transition-colors ${isFocused ? 'text-indigo-500' : 'text-slate-400 group-focus-within:text-indigo-500'}`}>
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4"><path fillRule="evenodd" d="M9 3.5a5.5 5.5 0 1 0 0 11 5.5 5.5 0 0 0 0 -11ZM2 9a7 7 0 1 1 12.452 4.391l3.328 3.329a.75.75 0 1 1-1.06 1.06l-3.329-3.328A7 7 0 0 1 2 9Z" clipRule="evenodd" /></svg>
            </div>
            <div className="absolute inset-y-0 right-0 flex items-center pr-2 pointer-events-none">
                <kbd className={`hidden group-hover:inline-flex items-center px-1.5 py-0.5 text-[10px] font-sans font-medium rounded transition-opacity border ${isFocused ? 'bg-indigo-50 dark:bg-indigo-500/20 text-indigo-600 dark:text-indigo-300 border-indigo-200 dark:border-indigo-500/30' : 'bg-slate-100 dark:bg-white/5 text-slate-400 dark:text-slate-500 border-slate-200 dark:border-white/10'}`}>
                  Ctrl K
                </kbd>
            </div>
          </div>
      </motion.div>
    );
  }
);
