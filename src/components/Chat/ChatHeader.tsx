
/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useRef, useEffect } from 'react';
import { motion as motionTyped, AnimatePresence } from 'framer-motion';
import { TextType } from '../UI/TextType';
import { Tooltip } from '../UI/Tooltip';
const motion = motionTyped as any;

type ChatHeaderProps = {
  handleToggleSidebar: () => void;
  isSidebarOpen: boolean;
  isSidebarCollapsed: boolean;
  onImportChat: () => void;
  onExportChat: (format: 'md' | 'json' | 'pdf') => void;
  onShareChat: () => void;
  isChatActive: boolean;
  isDesktop: boolean;
  chatTitle: string | null;
};

const MoreOptionsIcon = () => (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-5 h-5">
        <circle cx="12" cy="12" r="1"></circle>
        <circle cx="12" cy="5" r="1"></circle>
        <circle cx="12" cy="19" r="1"></circle>
    </svg>
);

const ShareIcon = () => (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4">
        <path d="M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8"></path>
        <polyline points="16 6 12 2 8 6"></polyline>
        <line x1="12" y1="2" x2="12" y2="15"></line>
    </svg>
);

const ImportIcon = () => (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4">
        <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
        <polyline points="7 10 12 15 17 10"></polyline>
        <line x1="12" y1="15" x2="12" y2="3"></line>
    </svg>
);

const ExportIcon = () => (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4">
        <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
        <polyline points="17 8 12 3 7 8"></polyline>
        <line x1="12" y1="3" x2="12" y2="15"></line>
    </svg>
);

const CodeIcon = () => (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4">
        <polyline points="16 18 22 12 16 6"></polyline>
        <polyline points="8 6 2 12 8 18"></polyline>
    </svg>
);

const PdfIcon = () => (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4">
        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
        <polyline points="14 2 14 8 20 8"></polyline>
        <line x1="16" y1="13" x2="8" y2="13"></line>
        <line x1="16" y1="17" x2="8" y2="17"></line>
        <polyline points="10 9 9 9 8 9"></polyline>
    </svg>
);

const MenuItem: React.FC<{ onClick: () => void; disabled: boolean; children: React.ReactNode; label: string }> = ({ onClick, disabled, children, label }) => (
    <li>
        <motion.button 
            onClick={onClick}
            disabled={disabled}
            className="w-full text-left flex items-center gap-3 px-4 py-2.5 text-sm font-medium transition-all text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-white/10 disabled:opacity-40 disabled:cursor-not-allowed active:scale-95"
            whileHover={{ x: 2, backgroundColor: 'rgba(var(--primary-main), 0.1)' }}
        >
            <span className="text-slate-400 dark:text-slate-500">{children}</span>
            <span>{label}</span>
        </motion.button>
    </li>
);

const MenuSectionTitle: React.FC<{ children: React.ReactNode }> = ({ children }) => (
    <li className="px-4 py-2 text-[11px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500 opacity-70 select-none mt-1">
        {children}
    </li>
);

const MenuDivider = () => <li className="my-1 h-px bg-slate-100 dark:bg-white/10 mx-2" />;

export const ChatHeader = ({ 
    handleToggleSidebar, 
    isSidebarOpen, 
    isSidebarCollapsed, 
    onImportChat, 
    onExportChat, 
    onShareChat, 
    isChatActive, 
    isDesktop,
    chatTitle 
}: ChatHeaderProps) => {
    const [isMenuOpen, setIsMenuOpen] = useState(false);
    const menuRef = useRef<HTMLDivElement>(null);
    const buttonRef = useRef<HTMLButtonElement>(null);

    const [isAnimatingTitle, setIsAnimatingTitle] = useState(false);
    const [animationKey, setAnimationKey] = useState(chatTitle);
    const prevChatTitleRef = useRef(chatTitle);

    useEffect(() => {
        const prevTitle = prevChatTitleRef.current;
        const isGenerated = chatTitle && chatTitle !== 'New Chat' && chatTitle !== 'Generating title...';
        const wasPlaceholder = prevTitle === 'New Chat' || prevTitle === 'Generating title...';

        if (wasPlaceholder && isGenerated) {
            setAnimationKey(chatTitle);
            setIsAnimatingTitle(true);
        } else {
            setIsAnimatingTitle(false);
        }
        prevChatTitleRef.current = chatTitle;
    }, [chatTitle]);

    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (
                menuRef.current && !menuRef.current.contains(event.target as Node) &&
                buttonRef.current && !buttonRef.current.contains(event.target as Node)
            ) {
                setIsMenuOpen(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    const baseButtonClasses = "w-11 h-11 flex items-center justify-center rounded-full transition-all duration-200 bg-white/60 dark:bg-black/20 border shadow-sm hover:scale-105 active:scale-95 touch-manipulation";
    const activeClasses = "text-indigo-700 border-indigo-200 dark:text-indigo-300 dark:border-indigo-500/40";
    const inactiveClasses = "text-slate-700 border-slate-200/80 hover:bg-white dark:text-slate-200 dark:border-white/10 dark:hover:bg-black/40";
    
    const moreOptionsButtonClasses = `${baseButtonClasses} ${isMenuOpen ? activeClasses : inactiveClasses}`;

    return (
        <header className="py-3 px-4 sm:px-6 md:px-8 flex items-center justify-center sticky top-0 z-10 gap-4 w-full">
            <div className="w-full max-w-4xl flex items-center justify-between">
                {/* --- Left Toggle --- */}
                <div className="flex-shrink-0 w-11 h-11 flex items-center justify-center">
                    {(!isDesktop || isSidebarCollapsed) && (
                        <Tooltip content={isDesktop ? "Expand Sidebar" : "Open Sidebar"} position="bottom" delay={500}>
                            <button
                                onClick={handleToggleSidebar}
                                className="w-10 h-10 flex items-center justify-center rounded-xl text-slate-500 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-white/10 transition-colors"
                            >
                                <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                    <rect width="18" height="18" x="3" y="3" rx="2" ry="2"/>
                                    <line x1="9" y1="3" x2="9" y2="21"/>
                                </svg>
                            </button>
                        </Tooltip>
                    )}
                </div>

                {/* --- Centered Title --- */}
                <div className="flex-1 min-w-0 text-center">
                    <AnimatePresence>
                        {chatTitle && (
                            <motion.div
                                initial={{ opacity: 0, y: -10 }}
                                animate={{ opacity: 1, y: 0 }}
                                exit={{ opacity: 0, y: -10 }}
                                className="inline-block text-sm font-semibold text-gray-800 dark:text-slate-200 px-4 py-2 rounded-full bg-white/60 dark:bg-black/20 border border-slate-200/80 dark:border-white/10 shadow-sm min-h-[32px] backdrop-blur-none md:backdrop-blur-md" title={chatTitle}>
                                
                                {isAnimatingTitle && animationKey ? (
                                    <TextType
                                        key={animationKey}
                                        text={['New Chat', animationKey]}
                                        loop={false}
                                        onSequenceComplete={() => setIsAnimatingTitle(false)}
                                    />
                                ) : (
                                    <span className="truncate max-w-[200px] sm:max-w-sm md:max-w-md inline-block align-middle">
                                        {chatTitle}
                                    </span>
                                )}

                            </motion.div>
                        )}
                    </AnimatePresence>
                </div>

                {/* --- Right controls --- */}
                <div className="flex-shrink-0">
                    <div className="relative">
                        <Tooltip content="Options" position="bottom" delay={500}>
                            <button
                                ref={buttonRef}
                                onClick={() => setIsMenuOpen(prev => !prev)}
                                className={moreOptionsButtonClasses}
                                aria-label="Chat options"
                                aria-haspopup="true"
                                aria-expanded={isMenuOpen}
                            >
                                <MoreOptionsIcon />
                            </button>
                        </Tooltip>
                        
                        <AnimatePresence>
                            {isMenuOpen && (
                                <motion.div
                                    ref={menuRef}
                                    initial={{ opacity: 0, y: 8, scale: 0.95 }}
                                    animate={{ opacity: 1, y: 0, scale: 1 }}
                                    exit={{ opacity: 0, y: 8, scale: 0.95 }}
                                    transition={{ type: "spring", stiffness: 300, damping: 20 }}
                                    className="absolute right-0 top-full mt-2 w-64 bg-white dark:bg-[#1e1e1e] rounded-2xl shadow-2xl border border-gray-200 dark:border-white/10 p-2 z-20 origin-top-right overflow-hidden"
                                >
                                    <ul className="flex flex-col">
                                        <MenuSectionTitle>Actions</MenuSectionTitle>
                                        <MenuItem onClick={onShareChat} disabled={!isChatActive} label="Share to Clipboard">
                                            <ShareIcon />
                                        </MenuItem>

                                        <MenuDivider />
                                        
                                        <MenuSectionTitle>Management</MenuSectionTitle>
                                        <MenuItem onClick={() => { onImportChat(); setIsMenuOpen(false); }} disabled={false} label="Import Chat...">
                                            <ImportIcon />
                                        </MenuItem>

                                        <MenuDivider />

                                        <MenuSectionTitle>Export</MenuSectionTitle>
                                        <MenuItem onClick={() => onExportChat('md')} disabled={!isChatActive} label="Markdown">
                                            <ExportIcon />
                                        </MenuItem>
                                        <MenuItem onClick={() => onExportChat('json')} disabled={!isChatActive} label="JSON">
                                            <CodeIcon />
                                        </MenuItem>
                                        <MenuItem onClick={() => onExportChat('pdf')} disabled={!isChatActive} label="PDF">
                                            <PdfIcon />
                                        </MenuItem>
                                    </ul>
                                </motion.div>
                            )}
                        </AnimatePresence>
                    </div>
                </div>
            </div>
      </header>
    );
};
