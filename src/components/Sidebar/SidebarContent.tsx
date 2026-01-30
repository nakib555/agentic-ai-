
/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useRef } from 'react';
import { motion as motionTyped } from 'framer-motion';
import type { ChatSession } from '../../types';
import { SidebarHeader } from './SidebarHeader';
import { SearchInput } from './SearchInput';
import { NewChatButton } from './NewChatButton';
import { HistoryList } from './HistoryList';
import { SidebarFooter } from './SidebarFooter';
import { Logo } from '../UI/Logo';
import { Tooltip } from '../UI/Tooltip';

const motion = motionTyped as any;

type SidebarContentProps = {
    isCollapsed: boolean;
    isDesktop: boolean;
    setIsOpen: (isOpen: boolean) => void;
    setIsCollapsed: (collapsed: boolean) => void;
    history: ChatSession[];
    isHistoryLoading: boolean;
    currentChatId: string | null;
    onNewChat: () => void;
    isNewChatDisabled?: boolean;
    onLoadChat: (id: string) => void;
    onDeleteChat: (id: string) => void;
    onUpdateChatTitle: (id: string, title: string) => void;
    onSettingsClick: () => void;
};

// Icons for Mini Rail
const NewChatIcon = () => (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-6 h-6">
        <path d="M12 20h9"></path>
        <path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"></path>
    </svg>
);

const SettingsIcon = () => (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-6 h-6">
        <circle cx="12" cy="12" r="3"></circle>
        <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"></path>
    </svg>
);

const ExpandIcon = () => (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-6 h-6">
        <rect width="18" height="18" x="3" y="3" rx="2" ry="2" />
        <line x1="9" x2="9" y1="3" y2="21" />
        <path d="m13 14 2-2-2-2" />
    </svg>
);

export const SidebarContent: React.FC<SidebarContentProps> = React.memo(({ 
    isCollapsed, isDesktop, setIsOpen, setIsCollapsed,
    history, isHistoryLoading, currentChatId, onNewChat, isNewChatDisabled,
    onLoadChat, onDeleteChat, onUpdateChatTitle, onSettingsClick
}) => {
    const [searchQuery, setSearchQuery] = useState('');
    const searchInputRef = useRef<HTMLInputElement>(null);

    const handleNewChat = () => {
        onNewChat();
        setSearchQuery('');
        if (!isDesktop) {
            setIsOpen(false);
        }
    };

    const handleLoadChat = (id: string) => {
        onLoadChat(id);
        if (!isDesktop) {
            setIsOpen(false);
        }
    };

    // --- Mini Sidebar Rail (Desktop Collapsed) ---
    if (isDesktop && isCollapsed) {
        return (
            <div className="flex flex-col items-center h-full py-4 bg-layer-1 w-full gap-4">
                {/* Logo */}
                <div className="mb-4">
                    <Logo className="w-8 h-8" />
                </div>
                
                {/* New Chat */}
                <Tooltip content="New Chat" position="right" sideOffset={10}>
                    <button 
                        onClick={handleNewChat}
                        disabled={isNewChatDisabled}
                        className="p-3 rounded-xl text-slate-500 hover:text-slate-800 hover:bg-slate-200/50 dark:text-slate-400 dark:hover:text-slate-200 dark:hover:bg-white/10 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                        aria-label="New Chat"
                    >
                        <NewChatIcon />
                    </button>
                </Tooltip>

                <div className="flex-1 w-full flex flex-col items-center gap-2 mt-2 pt-2 border-t border-border">
                    {/* Placeholder for recent icons could go here */}
                </div>

                {/* Bottom Actions */}
                <div className="mt-auto flex flex-col gap-2 border-t border-border pt-4 w-full items-center">
                     <Tooltip content="Expand Sidebar" position="right" sideOffset={10}>
                        <button 
                            onClick={() => setIsCollapsed(false)}
                            className="p-3 rounded-xl text-slate-500 hover:text-slate-800 hover:bg-slate-200/50 dark:text-slate-400 dark:hover:text-slate-200 dark:hover:bg-white/10 transition-all"
                            aria-label="Expand Sidebar"
                        >
                            <ExpandIcon />
                        </button>
                    </Tooltip>

                    <Tooltip content="Settings" position="right" sideOffset={10}>
                        <button 
                            onClick={onSettingsClick}
                            className="p-3 rounded-xl text-slate-500 hover:text-slate-800 hover:bg-slate-200/50 dark:text-slate-400 dark:hover:text-slate-200 dark:hover:bg-white/10 transition-all"
                            aria-label="Settings"
                        >
                            <SettingsIcon />
                        </button>
                    </Tooltip>
                </div>
            </div>
        );
    }

    // --- Full Sidebar (Mobile or Desktop Expanded) ---
    return (
        <>
            <SidebarHeader 
                isCollapsed={isCollapsed}
                isDesktop={isDesktop}
                setIsOpen={setIsOpen} 
                setIsCollapsed={setIsCollapsed}
            />

            <SearchInput 
                ref={searchInputRef}
                isCollapsed={isCollapsed}
                isDesktop={isDesktop}
                searchQuery={searchQuery}
                setSearchQuery={setSearchQuery}
            />

            <NewChatButton
                isCollapsed={isCollapsed}
                isDesktop={isDesktop}
                onClick={handleNewChat}
                disabled={isNewChatDisabled}
            />
            
            <motion.div 
                className="mb-2 border-t border-border"
                initial={false}
                animate={{ opacity: 1, height: 'auto' }}
                transition={{ duration: 0.3 }}
            />

            <HistoryList 
                history={history}
                isHistoryLoading={isHistoryLoading}
                currentChatId={currentChatId}
                searchQuery={searchQuery}
                isCollapsed={isCollapsed}
                isDesktop={isDesktop}
                onLoadChat={handleLoadChat}
                onDeleteChat={onDeleteChat}
                onUpdateChatTitle={onUpdateChatTitle}
            />
            
            <SidebarFooter 
                isCollapsed={isCollapsed}
                isDesktop={isDesktop}
                onSettingsClick={onSettingsClick}
            />
        </>
    );
});
