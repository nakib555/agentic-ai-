
/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { motion as motionTyped } from 'framer-motion';

const motion = motionTyped as any;

type SettingsCategoryButtonProps = {
  icon: React.ReactNode;
  label: string;
  isActive: boolean;
  onClick: (e: React.MouseEvent<HTMLButtonElement>) => void;
};

export const SettingsCategoryButton: React.FC<SettingsCategoryButtonProps> = ({ icon, label, isActive, onClick }) => (
  <button
    onClick={onClick}
    className={`group relative flex-shrink-0 md:flex-shrink w-auto md:w-full flex items-center gap-2 md:gap-3 px-3 md:px-4 py-2.5 md:py-3.5 rounded-xl md:rounded-2xl text-xs md:text-sm font-medium text-left transition-all duration-300 outline-none ${
      isActive 
        ? 'text-indigo-600 dark:text-indigo-300' 
        : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
    }`}
  >
    {isActive && (
      <motion.div
        layoutId="settings-active-pill"
        className="absolute inset-0 bg-white dark:bg-white/10 shadow-[0_2px_8px_rgba(0,0,0,0.04)] dark:shadow-none border border-slate-200/50 dark:border-white/5 rounded-xl md:rounded-2xl"
        transition={{ type: "spring", stiffness: 400, damping: 30 }}
      />
    )}
    
    {/* Hover State Background */}
    <div className={`absolute inset-0 rounded-xl md:rounded-2xl transition-opacity duration-200 ${isActive ? 'opacity-0' : 'bg-slate-100/50 dark:bg-white/5 opacity-0 group-hover:opacity-100'}`} />

    {/* Icon Container */}
    <span className={`relative z-10 flex items-center justify-center w-7 h-7 md:w-8 md:h-8 rounded-lg transition-all duration-300 ${
        isActive 
            ? 'bg-indigo-50 dark:bg-indigo-500/20 text-indigo-600 dark:text-indigo-400 scale-110' 
            : 'bg-slate-100 dark:bg-white/5 text-slate-400 dark:text-slate-500 group-hover:text-slate-600 dark:group-hover:text-slate-300 group-hover:scale-105'
    }`}>
        {icon}
    </span>

    <span className="relative z-10 flex-1 font-semibold tracking-wide whitespace-nowrap">{label}</span>
    
    {/* Arrow indicator for active state (Desktop) */}
    {isActive && (
        <motion.span 
            initial={{ opacity: 0, x: -5 }}
            animate={{ opacity: 1, x: 0 }}
            className="relative z-10 text-indigo-400 dark:text-indigo-500 hidden md:block ml-auto"
        >
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4">
                <path fillRule="evenodd" d="M7.21 14.77a.75.75 0 01.02-1.06L11.168 10 7.23 6.29a.75.75 0 111.04-1.08l4.5 4.25a.75.75 0 010 1.08l-4.5 4.25a.75.75 0 01-1.06-.02z" clipRule="evenodd" />
            </svg>
        </motion.span>
    )}
  </button>
);
