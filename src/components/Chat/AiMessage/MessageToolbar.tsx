/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { motion as motionTyped, AnimatePresence } from 'framer-motion';
import { TtsButton } from './TtsButton';
import type { Source } from '../../../types';
import { SourcesPills } from '../../AI/SourcesPills';
import { BranchSwitcher } from '../../UI/BranchSwitcher';
import { AudioWave } from '../../UI/AudioWave';
import { Tooltip } from '../../UI/Tooltip';
import { fetchFromApi } from '../../../utils/api';

const motion = motionTyped as any;

type MessageToolbarProps = {
    chatId: string | null;
    messageId: string;
    messageText: string;
    rawText: string;
    sources: Source[];
    onShowSources: (sources: Source[]) => void;
    ttsState: 'idle' | 'loading' | 'error' | 'playing';
    ttsErrorMessage?: string;
    onTtsClick: () => void;
    onRegenerate: () => void;
    responseCount: number;
    activeResponseIndex: number;
    onNavigateBranch?: (messageId: string, direction: 'next' | 'prev') => void;
};

type FeedbackState = 'up' | 'down' | null;

const ThumbsUpIcon = () => (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4">
        <path d="M7 10v12" />
        <path d="M15 5.88 14 10h5.83a2 2 0 0 1 1.92 2.56l-2.33 8A2 2 0 0 1 17.5 22H4a2 2 0 0 1-2-2v-8a2 2 0 0 1 2-2h2.76a2 2 0 0 0 1.79-1.11L12 2h0a3.13 3.13 0 0 1 3 3.88Z" />
    </svg>
);

const ThumbsDownIcon = () => (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4">
        <path d="M17 14V2" />
        <path d="M9 18.12 10 14H4.17a2 2 0 0 1-1.92-2.56l2.33-8A2 2 0 0 1 6.5 2H20a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2h-2.76a2 2 0 0 0-1.79 1.11L12 22h0a3.13 3.13 0 0 1-3-3.88Z" />
    </svg>
);

const IconButton: React.FC<{
    title: string;
    onClick?: () => void;
    disabled?: boolean;
    children: React.ReactNode;
    active?: boolean;
}> = ({ title, onClick, disabled, children, active }) => {
    const button = (
        <button
            type="button"
            onClick={onClick}
            disabled={disabled}
            className={`
                flex-shrink-0 w-8 h-8 flex items-center justify-center rounded-lg transition-all duration-200 
                ${active 
                    ? 'bg-indigo-100 text-indigo-700 dark:bg-indigo-500/20 dark:text-indigo-300' 
                    : 'text-slate-500 hover:bg-slate-100 hover:text-slate-800 dark:text-slate-400 dark:hover:bg-white/10 dark:hover:text-slate-200'
                }
                disabled:opacity-40 disabled:cursor-not-allowed
            `}
        >
            {children}
        </button>
    );

    return (
        <Tooltip content={title} position="top" delay={600}>
            {button}
        </Tooltip>
    );
};

export const MessageToolbar: React.FC<MessageToolbarProps> = ({
    chatId, messageId, messageText, sources, onShowSources, ttsState, ttsErrorMessage, onTtsClick, onRegenerate,
    responseCount, activeResponseIndex, onNavigateBranch,
}) => {
    const [isCopied, setIsCopied] = useState(false);
    const [feedback, setFeedback] = useState<FeedbackState>(null);

    const handleCopy = () => {
        navigator.clipboard.writeText(messageText).then(() => {
            setIsCopied(true);
            setTimeout(() => setIsCopied(false), 2000);
        });
    };

    const handleFeedback = (type: 'up' | 'down') => {
        const newFeedback = feedback === type ? null : type;
        setFeedback(newFeedback);
        
        if (chatId) {
            fetchFromApi('/api/handler?task=feedback', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ chatId, messageId, feedback: newFeedback }),
                silent: true
            });
        }
    };

    const handleBranchChange = (index: number) => {
        if (!onNavigateBranch) return;
        const direction = index > activeResponseIndex ? 'next' : 'prev';
        onNavigateBranch(messageId, direction);
    };

    return (
        <div className="w-full flex flex-wrap items-center justify-between gap-y-3 pt-3 mt-1 select-none border-t border-slate-100 dark:border-white/5">
            <div className="flex items-center gap-1">
                <IconButton title={isCopied ? 'Copied!' : 'Copy'} onClick={handleCopy}>
                    <AnimatePresence mode="wait" initial={false}>
                        {isCopied ? (
                            <motion.div key="check" initial={{ opacity: 0, scale: 0.5 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.5 }} className="text-green-500">
                                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4">
                                    <path fillRule="evenodd" d="M16.704 4.153a.75.75 0 0 1 .143 1.052l-8 10.5a.75.75 0 0 1-1.127.075l-4.5-4.5a.75.75 0 0 1 1.06-1.06l3.894 3.893 7.48-9.817a.75.75 0 0 1 1.05-.143Z" clipRule="evenodd" />
                                </svg>
                            </motion.div>
                        ) : (
                            <motion.div key="copy" initial={{ opacity: 0, scale: 0.5 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.5 }}>
                                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4">
                                    <rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect>
                                    <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path>
                                </svg>
                            </motion.div>
                        )}
                    </AnimatePresence>
                </IconButton>

                <IconButton title="Regenerate response" onClick={onRegenerate}>
                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4">
                        <path d="M23 4v6h-6"></path>
                        <path d="M1 20v-6h6"></path>
                        <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"></path>
                    </svg>
                </IconButton>

                <div className="w-px h-3 bg-slate-300 dark:bg-white/20 mx-2"></div>

                <div className="flex items-center">
                    <TtsButton 
                        isPlaying={ttsState === 'playing'} 
                        isLoading={ttsState === 'loading'} 
                        error={ttsState === 'error'}
                        errorMessage={ttsErrorMessage}
                        disabled={!messageText}
                        onClick={onTtsClick} 
                    />
                    
                    <AnimatePresence>
                        {ttsState === 'playing' && (
                            <motion.div
                                initial={{ width: 0, opacity: 0 }}
                                animate={{ width: 'auto', opacity: 1 }}
                                exit={{ width: 0, opacity: 0 }}
                                transition={{ duration: 0.2 }}
                                className="overflow-hidden"
                            >
                                <AudioWave isPlaying={true} className="ml-2 mr-2" barColor="bg-indigo-500 dark:bg-indigo-400" />
                            </motion.div>
                        )}
                        {ttsState === 'error' && (
                            <motion.div
                                initial={{ opacity: 0, x: -5, scale: 0.95 }}
                                animate={{ opacity: 1, x: 0, scale: 1 }}
                                exit={{ opacity: 0, x: -5, scale: 0.95 }}
                                transition={{ type: "spring", stiffness: 500, damping: 30 }}
                                className="ml-2"
                            >
                                <div 
                                    className="flex items-center gap-1.5 px-3 py-1 bg-red-50 dark:bg-red-900/20 border border-red-100 dark:border-red-800/30 rounded-full shadow-sm cursor-help group/error hover:bg-red-100 dark:hover:bg-red-900/40 transition-colors"
                                    title={ttsErrorMessage}
                                    role="alert"
                                >
                                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16" fill="currentColor" className="w-3.5 h-3.5 text-red-500">
                                        <path fillRule="evenodd" d="M8 15A7 7 0 1 0 8 1a7 7 0 0 0 0 14ZM8 4a.75.75 0 0 1 .75.75v3a.75.75 0 0 1-1.5 0v-3A.75.75 0 0 1 8 4Zm0 8a1 1 0 1 0 0-2 1 1 0 0 0 0 2Z" clipRule="evenodd" />
                                    </svg>
                                    <span className="text-[10px] font-medium text-red-600 dark:text-red-400 max-w-[150px] truncate group-hover/error:max-w-[300px] transition-all duration-300">
                                        {ttsErrorMessage || 'Audio Unavailable'}
                                    </span>
                                </div>
                            </motion.div>
                        )}
                    </AnimatePresence>
                </div>
                
                <div className="w-px h-3 bg-slate-300 dark:bg-white/20 mx-2"></div>
                
                <IconButton 
                    title="Good response" 
                    onClick={() => handleFeedback('up')} 
                    active={feedback === 'up'}
                >
                    <ThumbsUpIcon />
                </IconButton>
                <IconButton 
                    title="Bad response" 
                    onClick={() => handleFeedback('down')} 
                    active={feedback === 'down'}
                >
                    <ThumbsDownIcon />
                </IconButton>
            </div>
            
            <div className="flex items-center gap-3">
                 <SourcesPills sources={sources} onShowSources={() => onShowSources(sources)} />
                 <BranchSwitcher 
                    count={responseCount} 
                    activeIndex={activeResponseIndex} 
                    onChange={handleBranchChange} 
                 />
            </div>
        </div>
    );
};