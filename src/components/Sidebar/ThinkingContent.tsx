
/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect, useMemo, useRef } from 'react';
import type { Message } from '../../types';
import { ThinkingWorkflow } from '../AI/ThinkingWorkflow';
import { ErrorDisplay } from '../UI/ErrorDisplay';

type ThinkingContentProps = {
    message: Message | null;
    sendMessage: (message: string, files?: File[], options?: { isHidden?: boolean; isThinkingModeEnabled?: boolean; }) => void;
    onRegenerate: (messageId: string) => void;
};

export const ThinkingContent: React.FC<ThinkingContentProps> = React.memo(({ message, sendMessage, onRegenerate }) => {
    const contentRef = useRef<HTMLDivElement>(null);

    const { status, statusColor, plan, executionLog } = useMemo(() => {
        if (!message) {
            return { status: 'Idle', statusColor: 'bg-slate-400', plan: '', executionLog: [] };
        }

        const { isThinking } = message;
        const activeResponse = (message.responses && message.responses[message.activeResponseIndex]) || null;
        const error = activeResponse?.error;
        
        // Use workflow parsed by backend
        const parsedPlan = activeResponse?.workflow?.plan || '';
        const parsedLog = activeResponse?.workflow?.executionLog || [];

        if (error) {
            return { status: 'Failed', statusColor: 'bg-red-500 dark:bg-red-600', plan: parsedPlan, executionLog: parsedLog };
        }
        if (!isThinking) {
            return { status: 'Completed', statusColor: 'bg-emerald-500 dark:bg-emerald-600', plan: parsedPlan, executionLog: parsedLog };
        }
        return { status: 'In Progress', statusColor: 'bg-indigo-500 animate-pulse', plan: parsedPlan, executionLog: parsedLog };
    }, [message]);

    const isLiveGeneration = useMemo(() => executionLog.some(node => node.status === 'active'), [executionLog]);

    useEffect(() => {
        if (isLiveGeneration && contentRef.current) {
            contentRef.current.scrollTo({
                top: contentRef.current.scrollHeight,
                behavior: 'smooth'
            });
        }
    }, [executionLog, isLiveGeneration]);

    if (!message) {
        return (
            <div className="flex flex-col items-center justify-center h-full text-center p-8 opacity-60">
                <div className="w-16 h-16 rounded-full bg-slate-100 dark:bg-white/5 flex items-center justify-center mb-4">
                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="w-8 h-8 text-slate-400">
                        <path d="M12 16a4 4 0 1 0 0-8 4 4 0 0 0 0 8Z" />
                        <path d="M3 12h1m8-9v1m8 8h1m-9 8v1M5.6 5.6l.7.7m12.1-.7-.7.7m0 11.4.7.7m-12.1-.7-.7.7" />
                    </svg>
                </div>
                <p className="text-sm font-medium text-slate-600 dark:text-slate-300">No active thought process</p>
                <p className="text-xs text-slate-500 dark:text-slate-500 mt-1">Select a message with reasoning to view details.</p>
            </div>
        );
    }

    const hasContent = plan || executionLog.length > 0;
    if (!hasContent) {
        const activeResponse = (message.responses && message.responses[message.activeResponseIndex]) || null;
        return (
            <div className="flex flex-col items-center justify-center h-full text-sm text-gray-500 dark:text-slate-400 p-4 text-center">
                <p className="mb-4">This message did not involve a complex thought process.</p>
                {activeResponse?.error && <ErrorDisplay error={activeResponse.error} />}
            </div>
       );
    }

    return (
        <div ref={contentRef} className="flex-1 overflow-y-auto py-4 min-h-0 bg-slate-50/50 dark:bg-black/10 w-full h-full">
            <div className="px-4 pb-3 border-b border-gray-200 dark:border-white/5 flex-shrink-0 w-full mb-4">
                <div className="flex items-center gap-3">
                    <h2 id="thinking-sidebar-title" className="text-lg font-bold text-gray-800 dark:text-slate-100">Reasoning</h2>
                    <span className={`px-2 py-0.5 text-[10px] uppercase font-bold tracking-wide text-white rounded-md ${statusColor}`}>
                        {status}
                    </span>
                </div>
            </div>

            <div className="space-y-6 px-4 pb-12 break-words">
                {/* Plan display removed to simplify UI as requested */}
                
                {executionLog.length > 0 && (
                     <section>
                        <div className="flex items-center gap-2 mb-3">
                            <div className="w-1 h-4 bg-emerald-500 rounded-full" />
                            <h3 className="text-xs font-bold uppercase tracking-widest text-slate-500 dark:text-slate-400">
                                Execution Log
                            </h3>
                        </div>
                        <ThinkingWorkflow
                            nodes={executionLog}
                            sendMessage={sendMessage}
                            onRegenerate={onRegenerate}
                            messageId={message.id}
                        />
                    </section>
                )}
            </div>
        </div>
    );
});
