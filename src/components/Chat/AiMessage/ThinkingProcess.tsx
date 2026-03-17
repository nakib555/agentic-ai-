
/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useRef } from 'react';
import { motion as motionTyped, AnimatePresence } from 'framer-motion';
import { ManualCodeRenderer } from '../../Markdown/ManualCodeRenderer';
import { WorkflowMarkdownComponents } from '../../Markdown/markdownComponents';

const motion = motionTyped as any;

type ThinkingProcessProps = {
    thinkingText: string;
    isThinking: boolean;
    startTime?: number;
    endTime?: number;
};

// Isolated timer component to prevent re-rendering the heavy thinking process text
const DurationTimer = ({ startTime, endTime, isThinking }: { startTime?: number, endTime?: number, isThinking: boolean }) => {
    const [elapsed, setElapsed] = useState(0);

    useEffect(() => {
        if (!startTime) return;
        
        // If done, show final time
        if (!isThinking && endTime) {
            setElapsed((endTime - startTime) / 1000);
            return;
        }

        // Only run interval if thinking
        if (isThinking) {
             // Update immediately to avoid lag
             setElapsed((Date.now() - startTime) / 1000);
             
             const interval = setInterval(() => {
                 setElapsed((Date.now() - startTime) / 1000);
             }, 100);
             return () => clearInterval(interval);
        }
    }, [isThinking, startTime, endTime]);

    if (!startTime) return null;
    return <span className="text-xs font-mono text-slate-400 dark:text-slate-500">{elapsed.toFixed(1)}s</span>;
};

export const ThinkingProcess: React.FC<ThinkingProcessProps> = ({ thinkingText, isThinking, startTime, endTime }) => {
    const [isOpen, setIsOpen] = useState(false);
    // Auto-open only on initial mount if actively thinking, but respect user toggling afterwards
    const hasAutoOpened = useRef(false);

    useEffect(() => {
        if (isThinking && !hasAutoOpened.current && thinkingText.length > 0) {
            setIsOpen(true);
            hasAutoOpened.current = true;
        }
        // Auto-collapse when done thinking
        if (!isThinking && hasAutoOpened.current) {
            setIsOpen(false);
        }
    }, [isThinking, thinkingText.length]);

    if (!thinkingText) return null;

    return (
        <div className="w-full mb-4">
            <button
                onClick={() => setIsOpen(!isOpen)}
                className={`
                    w-full flex items-center justify-between px-4 py-3 rounded-xl border transition-all duration-200
                    ${isOpen 
                        ? 'bg-white dark:bg-white/5 border-slate-200 dark:border-white/10' 
                        : 'bg-slate-50 dark:bg-black/20 border-transparent hover:bg-slate-100 dark:hover:bg-white/5'
                    }
                `}
            >
                <div className="flex items-center gap-3">
                    <div className={`
                        flex items-center justify-center w-6 h-6 rounded-md transition-colors
                        ${isThinking 
                            ? 'bg-indigo-100 text-indigo-600 dark:bg-indigo-500/20 dark:text-indigo-400' 
                            : 'bg-slate-200 text-slate-500 dark:bg-white/10 dark:text-slate-400'
                        }
                    `}>
                        {isThinking ? (
                            <svg className="w-3.5 h-3.5 animate-spin" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                            </svg>
                        ) : (
                            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-3.5 h-3.5">
                                <path d="M12 5a3 3 0 1 0-5.997.125 4 4 0 0 0-2.526 5.77 4 4 0 0 0 .556 6.588A4 4 0 1 0 12 18Z" />
                                <path d="M12 5a3 3 0 1 1 5.997.125 4 4 0 0 1 2.526 5.77 4 4 0 0 1-.556 6.588A4 4 0 1 1 12 18Z" />
                                <path d="M15 13a4.5 4.5 0 0 1-3-4 4.5 4.5 0 0 1-3 4" />
                                <path d="M17.599 6.5a3 3 0 0 0 .399-1.375" />
                                <path d="M6.003 5.125A3 3 0 0 0 6.401 6.5" />
                                <path d="M3.477 10.896a4 4 0 0 1 .585-.396" />
                                <path d="M19.938 10.5a4 4 0 0 1 .585.396" />
                                <path d="M6 18a4 4 0 0 1-1.97-1.375" />
                                <path d="M19.97 16.625A4.002 4.002 0 0 1 18 18" />
                            </svg>
                        )}
                    </div>
                    <div className="flex flex-col items-start">
                        <span className="text-sm font-semibold text-slate-700 dark:text-slate-200">
                            {isThinking ? 'Reasoning...' : 'Reasoning Process'}
                        </span>
                    </div>
                </div>
                
                <div className="flex items-center gap-3">
                    <DurationTimer startTime={startTime} endTime={endTime} isThinking={isThinking} />
                    <svg 
                        xmlns="http://www.w3.org/2000/svg" 
                        viewBox="0 0 20 20" 
                        fill="currentColor" 
                        className={`w-4 h-4 text-slate-400 transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`}
                    >
                        <path fillRule="evenodd" d="M5.23 7.21a.75.75 0 011.06.02L10 11.168l3.71-3.938a.75.75 0 111.08 1.04l-4.25 4.5a.75.75 0 01-1.08 0l-4.25-4.5a.75.75 0 01.02-1.06z" clipRule="evenodd" />
                    </svg>
                </div>
            </button>

            <AnimatePresence>
                {isOpen && (
                    <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: 'auto', opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        transition={{ duration: 0.2 }}
                        className="overflow-hidden bg-slate-50/50 dark:bg-black/10 rounded-b-xl border-x border-b border-slate-200 dark:border-white/10 -mt-1 mx-1"
                    >
                        <div className="p-4 pt-3">
                            <div className="text-xs sm:text-sm text-slate-600 dark:text-slate-400 workflow-markdown leading-relaxed">
                                <ManualCodeRenderer 
                                    text={thinkingText} 
                                    components={WorkflowMarkdownComponents} 
                                    isStreaming={isThinking} 
                                />
                            </div>
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
};
