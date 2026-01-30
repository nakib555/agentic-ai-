
/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, memo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import type { MessageError, ToolCallEvent, WorkflowNodeData } from '../../types';
import { ToolCallStep } from './ToolCallStep';
import { ManualCodeRenderer } from '../Markdown/ManualCodeRenderer';
import { WorkflowMarkdownComponents } from '../Markdown/markdownComponents';
import { SearchIcon } from './icons';
import { SearchToolResult } from './SearchToolResult';
import { FlowToken } from './FlowToken';

type WorkflowNodeProps = {
  node: WorkflowNodeData;
  sendMessage: (message: string, files?: File[], options?: { isHidden?: boolean; isThinkingModeEnabled?: boolean; }) => void;
  onRegenerate?: (messageId: string) => void;
  messageId?: string;
  isLast?: boolean;
};

// --- Icons ---
const ThoughtIcon = () => (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-3.5 h-3.5">
        <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path>
    </svg>
);

const ToolIcon = () => (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-3.5 h-3.5">
        <polyline points="4 17 10 11 4 5"></polyline>
        <line x1="12" y1="19" x2="20" y2="19"></line>
    </svg>
);

const ErrorIcon = () => (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" className="w-3 h-3">
        <line x1="18" y1="6" x2="6" y2="18"></line>
        <line x1="6" y1="6" x2="18" y2="18"></line>
    </svg>
);

// Component for streaming or static text details
const DetailsRenderer: React.FC<{ node: WorkflowNodeData }> = ({ node }) => {
    const detailsText = node.details as string;
    const isStreaming = node.status === 'active';
    const [animationComplete, setAnimationComplete] = useState(false);

    useEffect(() => {
        setAnimationComplete(false);
    }, [detailsText]);

    const showFinalContent = !isStreaming || animationComplete;

    return (
        <div className="text-sm text-slate-600 dark:text-slate-300 workflow-markdown leading-relaxed pt-2 pl-1">
            {isStreaming && !showFinalContent && (
                <FlowToken tps={40} onComplete={() => setAnimationComplete(true)}>
                    {detailsText}
                </FlowToken>
            )}
            {showFinalContent && (
                <ManualCodeRenderer text={detailsText} components={WorkflowMarkdownComponents} isStreaming={false} />
            )}
        </div>
    );
};

const WorkflowNodeRaw = ({ node, sendMessage, onRegenerate, messageId, isLast }: WorkflowNodeProps) => {
    const isActive = node.status === 'active';
    const isFailed = node.status === 'failed';
    const isDone = node.status === 'done';
    
    // Auto-expand active or failed nodes. Search nodes are expanded by default too.
    const [isExpanded, setIsExpanded] = useState(isActive || isFailed || node.type === 'duckduckgoSearch');

    useEffect(() => {
        if (isActive || isFailed) setIsExpanded(true);
    }, [isActive, isFailed]);

    if (node.type === 'act_marker') return null;

    // --- Timeline Icon Logic ---
    let Icon = ThoughtIcon;
    let iconBg = isDone ? 'bg-slate-100 dark:bg-white/10 text-slate-500' : 'bg-white dark:bg-[#1a1a1a] text-slate-400 border-slate-300 dark:border-white/20';
    let ringColor = 'ring-white dark:ring-[#1a1a1a]'; // Cuts the timeline line

    if (isActive) {
        iconBg = 'bg-indigo-100 dark:bg-indigo-500/20 text-indigo-600 dark:text-indigo-400 border-indigo-200 dark:border-indigo-500/40';
    } else if (isFailed) {
        Icon = ErrorIcon;
        iconBg = 'bg-red-100 dark:bg-red-500/20 text-red-600 dark:text-red-400 border-red-200 dark:border-red-500/40';
    } else if (isDone) {
        iconBg = 'bg-emerald-50 dark:bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-200 dark:border-emerald-500/30';
    }

    if (node.type === 'tool' || node.type === 'duckduckgoSearch') Icon = ToolIcon;
    if (node.type === 'duckduckgoSearch') Icon = SearchIcon;

    // --- Title & Metadata ---
    let title = node.title;
    const isSearch = node.type === 'duckduckgoSearch';
    
    // Custom handling for tool titles
    if (node.type === 'tool') {
        const toolName = (node.details as ToolCallEvent)?.call?.name || 'Tool';
        if (!title || title === toolName) {
            title = `Execute ${toolName}`;
        }
    }
    
    // Clean up Search titles
    if (isSearch) {
        title = `Search: "${title.replace(/^"/, '').replace(/"$/, '')}"`;
    }

    return (
        <div className="group relative pl-2 pb-2">
            {/* Timeline Icon Marker - Absolutely positioned relative to the container, creating the spine alignment */}
            <div className="absolute -left-[27px] sm:-left-[35px] top-0.5 flex flex-col items-center z-20">
                <div className={`w-8 h-8 rounded-full border-2 ${iconBg} ${ringColor} ring-4 flex items-center justify-center transition-colors duration-300`}>
                    {isActive ? (
                        <svg className="animate-spin w-3.5 h-3.5" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>
                    ) : (
                        <Icon />
                    )}
                </div>
            </div>

            {/* Node Content Card */}
            <div className="bg-white dark:bg-white/5 border border-slate-200 dark:border-white/5 rounded-lg overflow-hidden transition-shadow hover:shadow-sm">
                {/* Header (Click to Toggle) */}
                <div 
                    className="flex items-center gap-3 px-3 py-2 cursor-pointer select-none"
                    onClick={() => setIsExpanded(!isExpanded)}
                >
                    <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                            <span className={`text-sm font-semibold truncate ${isActive ? 'text-indigo-600 dark:text-indigo-400' : 'text-slate-700 dark:text-slate-200'}`}>
                                {title}
                            </span>
                            {node.duration && (
                                <span className="text-[10px] text-slate-400 font-mono ml-auto bg-slate-100 dark:bg-white/10 px-1.5 py-0.5 rounded">
                                    {node.duration.toFixed(1)}s
                                </span>
                            )}
                        </div>
                    </div>
                    {/* Chevron */}
                    <div className={`text-slate-400 transition-transform duration-200 ${isExpanded ? 'rotate-180' : ''}`}>
                         <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4"><path fillRule="evenodd" d="M5.23 7.21a.75.75 0 011.06.02L10 11.168l3.71-3.938a.75.75 0 111.08 1.04l-4.25 4.5a.75.75 0 01-1.08 0l-4.25-4.5a.75.75 0 01.02-1.06z" clipRule="evenodd" /></svg>
                    </div>
                </div>

                {/* Expanded Details */}
                <AnimatePresence>
                    {isExpanded && (
                        <motion.div
                            initial={{ height: 0, opacity: 0 }}
                            animate={{ height: 'auto', opacity: 1 }}
                            exit={{ height: 0, opacity: 0 }}
                            transition={{ duration: 0.2 }}
                            className="overflow-hidden"
                        >
                            <div className="px-3 pb-3 border-t border-slate-100 dark:border-white/5 pt-2">
                                {/* Special Rendering for Search Results */}
                                {isSearch ? (
                                    <SearchToolResult 
                                        query={node.title} 
                                        sources={(node.details as any)?.result ? extractSourcesFromSearchResult((node.details as any).result) : undefined} 
                                    />
                                ) : (
                                    renderNodeContent(node, sendMessage, onRegenerate, messageId)
                                )}
                            </div>
                        </motion.div>
                    )}
                </AnimatePresence>
            </div>
        </div>
    );
};

// Helper for search source extraction (reused from old WorkflowNode)
const extractSourcesFromSearchResult = (result: string) => {
    try {
        const sourcesMatch = result.match(/\[SOURCES_PILLS\]([\s\S]*?)\[\/SOURCES_PILLS\]/s);
        if (sourcesMatch && sourcesMatch[1]) {
            const regex = /-\s*\[([^\]]+)\]\(([^)]+)\)/g;
            const parsedSources: { uri: string; title: string; }[] = [];
            let match;
            while ((match = regex.exec(sourcesMatch[1])) !== null) {
                parsedSources.push({ title: match[1].trim(), uri: match[2].trim() });
            }
            return parsedSources;
        }
    } catch (e) { return []; }
    return [];
};

// Content Renderer
const renderNodeContent = (
    node: WorkflowNodeData, 
    sendMessage: WorkflowNodeProps['sendMessage'],
    onRegenerate?: (messageId: string) => void,
    messageId?: string
) => {
    // Tool Call
    if (typeof node.details === 'object' && 'call' in node.details && 'id' in node.details) {
        return <ToolCallStep event={node.details as ToolCallEvent} sendMessage={sendMessage} onRegenerate={onRegenerate} messageId={messageId} />;
    }

    // Error
    if (node.status === 'failed' && typeof node.details === 'object' && 'message' in node.details) {
        const error = node.details as MessageError;
        return (
            <div className="p-3 mt-1 rounded-lg bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800/50">
                <p className="text-sm font-semibold text-red-700 dark:text-red-300">Step Failed</p>
                <p className="text-xs text-red-600 dark:text-red-400 mt-1 font-mono">{error.message}</p>
                {onRegenerate && messageId && (
                    <button
                        onClick={() => onRegenerate(messageId)}
                        className="mt-2 text-xs font-medium text-red-700 dark:text-red-300 hover:underline flex items-center gap-1"
                    >
                       <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16" fill="currentColor" className="w-3 h-3"><path fillRule="evenodd" d="M8 3a5 5 0 1 0 4.546 2.914.5.5 0 0 1 .908-.417A6 6 0 1 1 8 2v1z"/><path d="M8 4.466V.534a.25.25 0 0 1 .41-.192l2.36 1.966c.12.1.12.284 0 .384L8.41 4.658A.25.25 0 0 1 8 4.466z"/></svg>
                       Regenerate
                    </button>
                )}
            </div>
        );
    }
    
    // Text Detail
    if (typeof node.details === 'string') {
        return <DetailsRenderer node={node} />;
    }
    
    return null;
};

export const WorkflowNode = memo(WorkflowNodeRaw);
