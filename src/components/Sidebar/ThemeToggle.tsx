
/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { motion as motionTyped } from 'framer-motion';
import type { Theme } from '../../hooks/useTheme';

const motion = motionTyped as any;

type ThemeToggleProps = {
    theme: Theme;
    setTheme: (theme: Theme) => void;
    variant?: 'compact' | 'cards'; // 'compact' for sidebar/headers, 'cards' for settings modal
};

const ThemePreviewIcon = ({ type, isActive }: { type: string, isActive: boolean }) => {
    // Shared layout skeleton for the preview
    const SkeletonUI = ({ bgClass, accentClass, textClass }: any) => (
        <div className={`w-full h-full p-3 flex flex-col gap-2 ${bgClass}`}>
            <div className="flex gap-2">
                <div className={`w-1/4 h-2 rounded-full opacity-40 ${textClass}`}></div>
                <div className="w-1/2 h-2 rounded-full opacity-20 ${textClass}"></div>
            </div>
            <div className={`w-full h-8 rounded-md opacity-10 ${textClass}`}></div>
            <div className="flex gap-2 mt-auto">
                <div className={`w-8 h-8 rounded-full ${accentClass} opacity-20`}></div>
                <div className="flex-1 flex flex-col gap-1.5 justify-center">
                    <div className={`w-full h-1.5 rounded-full opacity-30 ${textClass}`}></div>
                    <div className={`w-2/3 h-1.5 rounded-full opacity-20 ${textClass}`}></div>
                </div>
            </div>
        </div>
    );

    switch (type) {
        case 'light':
            return <SkeletonUI bgClass="bg-white" accentClass="bg-indigo-500" textClass="bg-slate-900" />;
        case 'dark':
            return <SkeletonUI bgClass="bg-slate-900" accentClass="bg-indigo-500" textClass="bg-slate-100" />;
        case 'system':
            return (
                <div className="w-full h-full relative flex overflow-hidden">
                    <div className="w-1/2 h-full">
                        <SkeletonUI bgClass="bg-white" accentClass="bg-indigo-500" textClass="bg-slate-900" />
                    </div>
                    <div className="w-1/2 h-full">
                        <SkeletonUI bgClass="bg-slate-900" accentClass="bg-indigo-500" textClass="bg-slate-100" />
                    </div>
                    <div className="absolute inset-y-0 left-1/2 w-px bg-slate-200 dark:bg-slate-700"></div>
                </div>
            );
        default:
            return null;
    }
};

export const ThemeToggle = ({ theme, setTheme, variant = 'compact' }: ThemeToggleProps) => {
    const options = [
        { value: 'light', label: 'Light', desc: 'Clean & Bright' },
        { value: 'dark', label: 'Dark', desc: 'Easy on the Eyes' },
        { value: 'system', label: 'Auto', desc: 'Follows System' },
    ];

    if (variant === 'cards') {
        return (
            <div className="grid grid-cols-3 gap-3 sm:gap-4 w-full">
                {options.map((option) => {
                    const isActive = theme === option.value;
                    return (
                        <button
                            key={option.value}
                            onClick={() => setTheme(option.value as Theme)}
                            aria-pressed={isActive}
                            aria-label={`Theme: ${option.label}`}
                            className={`
                                group relative flex flex-col items-center text-left rounded-xl border-2 transition-all duration-200 overflow-hidden outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 dark:focus:ring-offset-[#09090b]
                                ${isActive 
                                    ? 'border-indigo-500 dark:border-indigo-400 bg-indigo-50/10 dark:bg-indigo-500/5 shadow-md' 
                                    : 'border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700 bg-white dark:bg-[#18181b] hover:shadow-sm'
                                }
                            `}
                        >
                            <div className="w-full aspect-[1.8] sm:aspect-[1.6] bg-slate-100 dark:bg-black/20 border-b border-inherit relative">
                                <ThemePreviewIcon type={option.value} isActive={isActive} />
                                {isActive && (
                                    <div className="absolute top-2 right-2 w-6 h-6 rounded-full bg-indigo-500 text-white flex items-center justify-center shadow-sm ring-2 ring-white dark:ring-black">
                                        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-3.5 h-3.5">
                                            <path fillRule="evenodd" d="M16.704 4.153a.75.75 0 0 1 .143 1.052l-8 10.5a.75.75 0 0 1-1.127.075l-4.5-4.5a.75.75 0 0 1 1.06-1.06l3.894 3.893 7.48-9.817a.75.75 0 0 1 1.05-.143Z" clipRule="evenodd" />
                                        </svg>
                                    </div>
                                )}
                            </div>
                            <div className="w-full p-3 sm:p-4">
                                <span className={`block text-xs sm:text-sm font-bold ${isActive ? 'text-indigo-700 dark:text-indigo-300' : 'text-slate-800 dark:text-slate-200'}`}>
                                    {option.label}
                                </span>
                                <span className="block text-[10px] sm:text-xs text-slate-500 dark:text-slate-400 mt-0.5 sm:mt-1 font-medium">
                                    {option.desc}
                                </span>
                            </div>
                        </button>
                    );
                })}
            </div>
        );
    }

    // Default Compact Variant (Sidebar / Header)
    return (
        <div className="relative p-1 rounded-xl flex items-center bg-gray-100 dark:bg-black/20 border border-gray-200 dark:border-white/5 w-full">
            {options.map((option) => {
                const isActive = theme === option.value;
                return (
                    <button
                        key={option.value}
                        onClick={() => setTheme(option.value as Theme)}
                        aria-pressed={isActive}
                        aria-label={`Theme: ${option.label}`}
                        className={`
                            relative z-10 flex-1 flex items-center justify-center gap-2 py-1.5 px-2 rounded-lg text-xs font-medium transition-all duration-200 focus:outline-none touch-manipulation
                            ${isActive ? 'text-gray-900 dark:text-white font-semibold' : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200'}
                        `}
                        title={option.desc}
                    >
                        {isActive && (
                            <motion.div
                                layoutId="theme-pill-compact"
                                className="absolute inset-0 bg-white dark:bg-gray-700 shadow-sm rounded-lg border border-gray-200/50 dark:border-white/10"
                                transition={{ type: 'spring', stiffness: 500, damping: 30 }}
                            />
                        )}
                        <span className="relative z-10 truncate">{option.label}</span>
                    </button>
                );
            })}
        </div>
    );
};
