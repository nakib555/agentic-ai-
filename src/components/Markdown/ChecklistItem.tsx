
/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { motion } from 'framer-motion';

type ChecklistItemProps = {
  initialChecked: boolean;
  children: React.ReactNode;
};

export const ChecklistItem: React.FC<ChecklistItemProps> = ({ initialChecked, children }) => {
  const [isChecked, setIsChecked] = useState(initialChecked);

  return (
    <motion.div
      layout
      initial={false}
      role="checkbox"
      aria-checked={isChecked}
      tabIndex={0}
      className={`
        group flex items-start gap-3 p-3 my-1 rounded-xl cursor-pointer border transition-all duration-200 select-none focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 dark:focus:ring-offset-[#121212]
        ${isChecked 
          ? 'bg-slate-50/50 dark:bg-white/[0.02] border-transparent' 
          : 'bg-white dark:bg-white/5 border-slate-200 dark:border-white/5 hover:border-indigo-300 dark:hover:border-indigo-500/50 hover:shadow-sm'
        }
      `}
      onClick={(e) => {
        e.stopPropagation();
        setIsChecked(!isChecked);
      }}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          e.stopPropagation();
          setIsChecked(!isChecked);
        }
      }}
    >
      <div className="relative flex-shrink-0 mt-0.5">
        <motion.div
          className={`
            w-5 h-5 rounded-md border flex items-center justify-center transition-colors duration-200
            ${isChecked 
              ? 'bg-indigo-500 border-indigo-500' 
              : 'bg-white dark:bg-white/5 border-slate-300 dark:border-slate-600 group-hover:border-indigo-400'
            }
          `}
          whileTap={{ scale: 0.9 }}
        >
          <motion.svg
            initial={false}
            animate={{ 
              scale: isChecked ? 1 : 0, 
              opacity: isChecked ? 1 : 0 
            }}
            transition={{ type: "spring", stiffness: 400, damping: 25 }}
            xmlns="http://www.w3.org/2000/svg"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="3"
            strokeLinecap="round"
            strokeLinejoin="round"
            className="w-3.5 h-3.5 text-white"
          >
            <polyline points="20 6 9 17 4 12" />
          </motion.svg>
        </motion.div>
      </div>
      
      <div className={`flex-1 min-w-0 text-sm leading-relaxed transition-opacity duration-200 ${isChecked ? 'opacity-50' : 'opacity-100'}`}>
        <span className={`transition-all duration-200 ${isChecked ? 'line-through text-slate-500 dark:text-slate-500' : 'text-slate-700 dark:text-slate-200'}`}>
            {children}
        </span>
      </div>
    </motion.div>
  );
};
