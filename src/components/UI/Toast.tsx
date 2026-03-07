/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect } from 'react';
import { motion as motionTyped, AnimatePresence } from 'framer-motion';

const motion = motionTyped as any;

export type ToastType = 'success' | 'error' | 'info';

type ToastProps = {
    message: string | null;
    type?: ToastType;
    onClose: () => void;
    duration?: number;
};

export const Toast: React.FC<ToastProps> = ({ message, type = 'info', onClose, duration = 3000 }) => {
    useEffect(() => {
        if (message) {
            const timer = setTimeout(onClose, duration);
            return () => clearTimeout(timer);
        }
    }, [message, duration, onClose]);

    return (
        <AnimatePresence>
            {message && (
                <motion.div
                    initial={{ opacity: 0, y: -20, x: '-50%' }}
                    animate={{ opacity: 1, y: 0, x: '-50%' }}
                    exit={{ opacity: 0, y: -20, x: '-50%' }}
                    transition={{ duration: 0.3, ease: 'easeOut' }}
                    className={`fixed top-6 left-1/2 z-[200] px-4 py-2.5 rounded-full shadow-xl border bg-white/90 dark:bg-black/90 text-sm font-medium flex items-center gap-2.5 pointer-events-none select-none max-w-[calc(100vw-2rem)]
                        ${type === 'error' 
                            ? 'bg-red-50/95 text-red-700 border-red-200 dark:bg-red-900/90 dark:text-red-200 dark:border-red-800' 
                            : type === 'success' 
                                ? 'bg-green-50/95 text-green-700 border-green-200 dark:bg-green-900/90 dark:text-green-200 dark:border-green-800' 
                                : 'bg-white/95 text-slate-700 border-slate-200 dark:bg-slate-800/90 dark:text-slate-200 dark:border-slate-700'
                        }
                    `}
                >
                    {type === 'error' && (
                        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4 flex-shrink-0">
                            <path fillRule="evenodd" d="M18 10a8 8 0 1 1-16 0 8 8 0 0 1 16 0Zm-8-5a.75.75 0 0 1 .75.75v4.5a.75.75 0 0 1-1.5 0v-4.5A.75.75 0 0 1 10 5Zm0 10a1 1 0 1 0 0-2 1 1 0 0 0 0 2Z" clipRule="evenodd" />
                        </svg>
                    )}
                    {type === 'success' && (
                        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4 flex-shrink-0">
                            <path fillRule="evenodd" d="M10 18a8 8 0 1 0 0-16 8 8 0 0 0 0 16Zm3.857-9.809a.75.75 0 0 0-1.214-.882l-3.483 4.79-1.88-1.88a.75.75 0 1 0-1.06 1.061l2.5 2.5a.75.75 0 0 0 1.137-.089l4-5.5Z" clipRule="evenodd" />
                        </svg>
                    )}
                    <span className="truncate">{message}</span>
                </motion.div>
            )}
        </AnimatePresence>
    );
};