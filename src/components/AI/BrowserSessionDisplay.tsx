/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useMemo } from 'react';
import { motion as motionTyped, AnimatePresence } from 'framer-motion';

const motion = motionTyped as any;

type BrowserSessionDisplayProps = {
    url: string;
    title: string;
    screenshot: string;
    logs: string[];
};

export const BrowserSessionDisplay: React.FC<BrowserSessionDisplayProps> = ({ url, title, screenshot, logs = [] }) => {
    const [isLogsOpen, setIsLogsOpen] = useState(true); // Auto-open logs if live
    const [hostname, setHostname] = useState(url);

    useEffect(() => {
        try {
            if (url) setHostname(new URL(url).hostname);
        } catch (e) {}
    }, [url]);

    // Determine if "live" based on logs (if last log is not "Session finished")
    const lastLog = logs && logs.length > 0 ? logs[logs.length - 1] : '';
    const isFinished = lastLog.includes('Session finished') || lastLog.includes('Extracted');
    const isLoading = !isFinished;

    // Optimization: Limit visible logs to last 100 to prevent excessive DOM nodes
    const displayedLogs = useMemo(() => {
        if (!logs) return [];
        if (logs.length > 100) {
            return logs.slice(logs.length - 100);
        }
        return logs;
    }, [logs]);

    return (
        <motion.div 
            initial={{ opacity: 0, y: 10, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            className="my-4 w-full max-w-2xl mx-auto rounded-xl overflow-hidden border border-gray-200 dark:border-slate-700 shadow-lg bg-white dark:bg-[#1e1e1e]"
        >
            {/* Browser Chrome / Header */}
            <div className="flex items-center gap-4 px-4 py-3 bg-gray-100 dark:bg-[#2d2d2d] border-b border-gray-200 dark:border-slate-700">
                {/* Window Controls */}
                <div className="flex gap-1.5 flex-shrink-0">
                    <div className="w-3 h-3 rounded-full bg-[#FF5F57] border border-black/10"></div>
                    <div className="w-3 h-3 rounded-full bg-[#FEBC2E] border border-black/10"></div>
                    <div className="w-3 h-3 rounded-full bg-[#28C840] border border-black/10"></div>
                </div>

                {/* Address Bar */}
                <div className="flex-1 flex items-center justify-center">
                    <div className="flex items-center gap-2 px-3 py-1 bg-white dark:bg-black/20 rounded-md border border-gray-200 dark:border-white/5 w-full max-w-[300px] shadow-sm">
                        {isLoading ? (
                             <svg className="animate-spin h-3 w-3 text-slate-400" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                            </svg>
                        ) : (
                            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-3 h-3 text-slate-400">
                                <path fillRule="evenodd" d="M9.293 2.293a1 1 0 0 1 1.414 0l7 7A1 1 0 0 1 17 11h-1v6a1 1 0 0 1-1 1h-2a1 1 0 0 1-1-1v-3a1 1 0 0 0-1-1H9a1 1 0 0 0-1 1v3a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1v-6H3a1 1 0 0 1-.707-1.707l7-7Z" clipRule="evenodd" />
                            </svg>
                        )}
                        <span className="text-xs text-slate-600 dark:text-slate-300 truncate font-medium font-mono select-none opacity-90">
                            {hostname}
                        </span>
                    </div>
                </div>
                
                {/* Placeholder for symmetry */}
                <div className="w-10"></div>
            </div>

            {/* Viewport / Screenshot */}
            <div className="relative aspect-video bg-slate-100 dark:bg-black/50 w-full overflow-hidden group">
                {screenshot ? (
                    <img 
                        src={screenshot} 
                        alt={`Screenshot of ${title}`}
                        className="w-full h-full object-cover object-top"
                    />
                ) : (
                    <div className="flex flex-col items-center justify-center h-full gap-3">
                        <div className="relative w-12 h-12">
                            <div className="absolute inset-0 rounded-full border-4 border-slate-200 dark:border-slate-700"></div>
                            <div className="absolute inset-0 rounded-full border-4 border-indigo-500 border-t-transparent animate-spin"></div>
                        </div>
                        <div className="text-slate-400 text-sm font-medium animate-pulse">Initializing view...</div>
                    </div>
                )}
                
                {/* Title Overlay */}
                <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/60 to-transparent p-4 pt-8 opacity-0 group-hover:opacity-100 transition-opacity duration-300">
                    <p className="text-white text-sm font-medium truncate shadow-sm">{title || "Loading..."}</p>
                </div>
                
                {/* Live Indicator */}
                {isLoading && (
                    <div className="absolute top-3 right-3 flex items-center gap-1.5 bg-black/60 px-2 py-1 rounded-full border border-white/10 shadow-lg z-10">
                        <span className="relative flex h-2 w-2">
                          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
                          <span className="relative inline-flex rounded-full h-2 w-2 bg-green-500"></span>
                        </span>
                        <span className="text-[10px] font-bold text-white uppercase tracking-wider">Live</span>
                    </div>
                )}
            </div>

            {/* Footer / Logs */}
            <div className="bg-gray-50 dark:bg-[#252525] border-t border-gray-200 dark:border-slate-700">
                <button 
                    onClick={() => setIsLogsOpen(!isLogsOpen)}
                    className="w-full flex items-center justify-between px-4 py-2 text-xs font-medium text-slate-500 dark:text-slate-400 hover:bg-gray-100 dark:hover:bg-white/5 transition-colors"
                    aria-expanded={isLogsOpen}
                    aria-label="Toggle Activity Log"
                >
                    <div className="flex items-center gap-2">
                        {isLoading ? (
                             <div className="w-1.5 h-1.5 rounded-full bg-indigo-500 animate-pulse"></div>
                        ) : (
                             <div className="w-1.5 h-1.5 rounded-full bg-slate-400"></div>
                        )}
                        <span>Activity Log ({logs ? logs.length : 0})</span>
                    </div>
                    <svg 
                        xmlns="http://www.w3.org/2000/svg" 
                        viewBox="0 0 20 20" 
                        fill="currentColor" 
                        className={`w-4 h-4 transition-transform duration-200 ${isLogsOpen ? 'rotate-180' : ''}`}
                    >
                        <path fillRule="evenodd" d="M5.23 7.21a.75.75 0 011.06.02L10 11.168l3.71-3.938a.75.75 0 111.08 1.04l-4.25 4.5a.75.75 0 01-1.08 0l-4.25-4.5a.75.75 0 01.02-1.06z" clipRule="evenodd" />
                    </svg>
                </button>

                <AnimatePresence>
                    {isLogsOpen && (
                        <motion.div
                            initial={{ height: 0, opacity: 0 }}
                            animate={{ height: 'auto', opacity: 1 }}
                            exit={{ height: 0, opacity: 0 }}
                            transition={{ duration: 0.2 }}
                            className="overflow-hidden"
                        >
                            <div className="px-4 pb-3 pt-1 space-y-1.5 max-h-32 overflow-y-auto custom-scrollbar">
                                {displayedLogs.map((log, index) => (
                                    <div 
                                        key={index}
                                        className={`flex items-start gap-2 text-[11px] font-mono ${index === displayedLogs.length - 1 ? 'text-indigo-600 dark:text-indigo-400 font-bold' : 'text-slate-600 dark:text-slate-400'}`}
                                    >
                                        <span className="opacity-60 mt-0.5">➜</span>
                                        <span className="break-all">{log}</span>
                                    </div>
                                ))}
                                {isLoading && (
                                     <motion.div 
                                        initial={{ opacity: 0 }}
                                        animate={{ opacity: 1 }}
                                        className="flex items-center gap-1 pl-4 pt-1"
                                     >
                                         <span className="w-1 h-1 bg-slate-400 rounded-full animate-bounce" style={{ animationDelay: '0s' }}></span>
                                         <span className="w-1 h-1 bg-slate-400 rounded-full animate-bounce" style={{ animationDelay: '0.2s' }}></span>
                                         <span className="w-1 h-1 bg-slate-400 rounded-full animate-bounce" style={{ animationDelay: '0.4s' }}></span>
                                     </motion.div>
                                )}
                            </div>
                        </motion.div>
                    )}
                </AnimatePresence>
            </div>
        </motion.div>
    );
};