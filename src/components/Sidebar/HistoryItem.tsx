/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { motion as motionTyped, AnimatePresence } from 'framer-motion';
import { Tooltip } from '../UI/Tooltip';
const motion = motionTyped as any;

const Highlight = ({ text, highlight }: { text: string, highlight: string }) => {
    if (!highlight.trim()) {
        return <span>{text}</span>;
    }
    const escapedHighlight = highlight.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const regex = new RegExp(`(${escapedHighlight})`, 'gi');
    const parts = text.split(regex);
    return (
        <span>
            {parts.map((part, i) =>
                part.toLowerCase() === highlight.toLowerCase() ? (
                    <span key={i} className="bg-amber-200 dark:bg-amber-400 text-amber-900 dark:text-black rounded-sm px-0.5">{part}</span>
                ) : (
                    <span key={i}>{part}</span>
                )
            )}
        </span>
    );
};

const ModelBadge = ({ model }: { model: string }) => {
    const isPro = model.toLowerCase().includes('pro');
    const isFlash = model.toLowerCase().includes('flash');
    
    let colorClass = 'bg-slate-400';
    if (isPro) colorClass = 'bg-purple-500';
    else if (isFlash) colorClass = 'bg-yellow-500';
    
    return (
        <div className={`w-1.5 h-1.5 rounded-full ${colorClass} opacity-60 flex-shrink-0`} title={model}></div>
    );
};

type HistoryItemProps = {
    text: string;
    model?: string;
    isCollapsed: boolean;
    isDesktop: boolean;
    searchQuery: string;
    active: boolean;
    isLoading: boolean;
    onClick: () => void;
    onDelete: () => void;
    onUpdateTitle: (newTitle: string) => void;
};

export const HistoryItem: React.FC<HistoryItemProps> = ({ text, model, isCollapsed, isDesktop, searchQuery, active, isLoading, onClick, onDelete, onUpdateTitle }) => {
    const [isEditing, setIsEditing] = useState(false);
    const [editedTitle, setEditedTitle] = useState(text);
    const [isMenuOpen, setIsMenuOpen] = useState(false);
    
    // State for Portal Positioning
    const [menuCoords, setMenuCoords] = useState({ top: 0, left: 0 });

    const inputRef = useRef<HTMLInputElement>(null);
    const menuRef = useRef<HTMLDivElement>(null);
    const buttonRef = useRef<HTMLButtonElement>(null);
    const containerRef = useRef<HTMLDivElement>(null);

    const shouldCollapse = isDesktop && isCollapsed;

    useEffect(() => {
        if (isEditing && inputRef.current) {
            inputRef.current.focus();
            inputRef.current.select();
        }
    }, [isEditing]);

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
        return () => {
            document.removeEventListener('mousedown', handleClickOutside);
        };
    }, []);
    
    // Calculate menu position when opening
    useEffect(() => {
        if (isMenuOpen && buttonRef.current) {
            const rect = buttonRef.current.getBoundingClientRect();
            const menuWidth = 128; // w-32
            const menuHeight = 85; // approximate height
            const padding = 4;

            let top = rect.bottom + padding;
            let left = rect.right - menuWidth; // Align right edge

            // Check if it overflows bottom of viewport
            if (top + menuHeight > window.innerHeight) {
                // Flip to top
                top = rect.top - menuHeight - padding;
            }

            // Check horizontal boundaries
            // If pushing left goes off-screen (unlikely unless button is very left), clamp
            if (left < padding) {
                left = padding;
            }
            
            // If button is so far right (or menu is wide) that right alignment clips left, 
            // or we prefer left alignment if space permits. 
            // But usually "Align Right" is standard for kebab menus on right side.
            
            // Just ensure right side doesn't overflow viewport width
            if (left + menuWidth > window.innerWidth) {
                left = window.innerWidth - menuWidth - padding;
            }

            setMenuCoords({ top, left });

            // Close on scroll/resize to prevent detached menu
            const handleScroll = () => setIsMenuOpen(false);
            window.addEventListener('scroll', handleScroll, true);
            window.addEventListener('resize', handleScroll);
            return () => {
                window.removeEventListener('scroll', handleScroll, true);
                window.removeEventListener('resize', handleScroll);
            };
        }
    }, [isMenuOpen]);
    
    useEffect(() => {
        if (!isEditing) {
            setEditedTitle(text);
        }
    }, [text, isEditing]);

    const handleSave = () => {
        const newTitle = editedTitle.trim();
        if (newTitle && newTitle !== text) {
            onUpdateTitle(newTitle);
        } else {
            setEditedTitle(text);
        }
        setIsEditing(false);
    };

    const handleCancel = () => {
        setEditedTitle(text);
        setIsEditing(false);
    };

    const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
        if (e.key === 'Enter') {
            handleSave();
        } else if (e.key === 'Escape') {
            handleCancel();
        }
    };

    const handleEditClick = (e: React.MouseEvent) => {
        e.stopPropagation();
        setIsMenuOpen(false);
        setIsEditing(true);
    };

    const handleDelete = (e: React.MouseEvent) => {
        e.stopPropagation();
        setIsMenuOpen(false);
        onDelete();
    };

    const handleDoubleClick = (e: React.MouseEvent) => {
        e.stopPropagation();
        if (!shouldCollapse) {
            setIsEditing(true);
        }
    };

    return (
        <div ref={containerRef} className="relative group/item">
            <button 
                onClick={isEditing ? undefined : onClick} 
                onDoubleClick={handleDoubleClick}
                disabled={isEditing}
                className={`
                    w-full text-sm py-2 px-3 rounded-lg text-left flex items-center gap-3 transition-all duration-200
                    ${active 
                        ? 'bg-white dark:bg-white/10 text-indigo-700 dark:text-indigo-300 font-semibold shadow-sm ring-1 ring-slate-200 dark:ring-white/5' 
                        : 'text-slate-600 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-white/5 dark:hover:text-slate-200'
                    } 
                    ${shouldCollapse ? 'justify-center px-2' : ''} 
                    ${!shouldCollapse ? 'pr-8' : ''}
                `}
            >
                {isLoading ? (
                    <div className="w-5 h-5 flex-shrink-0 flex items-center justify-center">
                         <div className="w-2 h-2 bg-indigo-500 dark:bg-indigo-400 rounded-full animate-pulse"></div>
                    </div>
                ) : (
                   model && !shouldCollapse && <ModelBadge model={model} />
                )}
                
                {isEditing ? (
                    <input
                        ref={inputRef}
                        type="text"
                        value={editedTitle}
                        onChange={(e) => setEditedTitle(e.target.value)}
                        onKeyDown={handleKeyDown}
                        onBlur={handleSave}
                        onClick={(e) => e.stopPropagation()}
                        className="flex-1 w-full bg-white dark:bg-black/30 focus:outline-none text-sm font-semibold ring-2 ring-indigo-500 rounded px-1 -mx-1"
                    />
                ) : (
                    <motion.span 
                        className="flex-1 min-w-0 overflow-hidden truncate"
                        initial={false}
                        animate={{ width: shouldCollapse ? 0 : 'auto', opacity: shouldCollapse ? 0 : 1 }}
                        transition={{ duration: 0.2 }}
                    >
                         <Highlight text={text} highlight={searchQuery} />
                    </motion.span>
                )}
            </button>

            {!shouldCollapse && !isEditing && (
                <div 
                    className={`
                        absolute right-2 top-1/2 -translate-y-1/2 flex items-center transition-opacity opacity-100
                    `}
                >
                    <Tooltip content="More options" position="right" delay={500}>
                        <button
                            ref={buttonRef}
                            onClick={(e) => { e.stopPropagation(); setIsMenuOpen(prev => !prev); }}
                            aria-label="More options"
                            aria-haspopup="true"
                            aria-expanded={isMenuOpen}
                            className={`p-1 rounded-md text-slate-400 hover:text-slate-700 dark:text-slate-500 dark:hover:text-slate-200 hover:bg-slate-200/50 dark:hover:bg-white/10 transition-colors ${isMenuOpen ? 'bg-slate-200/50 dark:bg-white/10 text-slate-700 dark:text-slate-200 opacity-100' : ''}`}
                        >
                            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16" fill="currentColor" className="w-4 h-4"><path d="M8 3a1.5 1.5 0 1 1 0-3 1.5 1.5 0 0 1 0 3ZM8 9a1.5 1.5 0 1 1 0-3 1.5 1.5 0 0 1 0 3ZM8 15a1.5 1.5 0 1 1 0-3 1.5 1.5 0 0 1 0 3Z" /></svg>
                        </button>
                    </Tooltip>
                </div>
            )}
            
            {createPortal(
                <AnimatePresence>
                    {isMenuOpen && (
                        <motion.div
                            ref={menuRef}
                            initial={{ opacity: 0, scale: 0.95 }}
                            animate={{ opacity: 1, scale: 1 }}
                            exit={{ opacity: 0, scale: 0.95 }}
                            transition={{ duration: 0.1 }}
                            style={{
                                position: 'fixed',
                                top: menuCoords.top,
                                left: menuCoords.left,
                                zIndex: 99999
                            }}
                            className="w-32 bg-white dark:bg-[#252525] rounded-xl shadow-xl border border-gray-200 dark:border-white/10 p-1 overflow-hidden"
                            onClick={(e: React.MouseEvent) => e.stopPropagation()}
                        >
                            <ul className="flex flex-col gap-0.5" role="menu" aria-label="History item options">
                                <li role="none">
                                    <button role="menuitem" onClick={handleEditClick} className="w-full text-left flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-medium hover:bg-slate-100 dark:hover:bg-white/5 text-slate-700 dark:text-slate-200 transition-colors">
                                        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16" fill="currentColor" className="w-3.5 h-3.5"><path d="M11.355 2.212a.75.75 0 0 1 1.06 0l1.373 1.373a.75.75 0 0 1 0 1.06L5.435 13H3.25A.75.75 0 0 1 2.5 12.25V10l8.293-8.293a.75.75 0 0 1 .562-.294Z" /></svg>
                                        <span>Rename</span>
                                    </button>
                                </li>
                                <li role="none">
                                    <button role="menuitem" onClick={handleDelete} className="w-full text-left flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-medium hover:bg-red-50 dark:hover:bg-red-500/10 text-red-600 dark:text-red-400 transition-colors">
                                        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16" fill="currentColor" className="w-3.5 h-3.5"><path fillRule="evenodd" d="M5 3.25V4H2.75a.75.75 0 0 0 0 1.5h.3l.815 8.15A1.5 1.5 0 0 0 5.357 15h5.285a1.5 1.5 0 0 0 1.493-1.35l.815-8.15h.3a.75.75 0 0 0 0-1.5H11v-.75A2.25 2.25 0 0 0 8.75 1h-1.5A2.25 2.25 0 0 0 5 3.25Zm2.25-.75a.75.75 0 0 0-.75.75V4h3v-.75a.75.75 0 0 0-.75-.75h-1.5ZM6.05 6a.75.75 0 0 1 .787.713l.275 5.5a.75.75 0 0 1-1.498.075l-.275-5.5A.75.75 0 0 1 6.05 6Zm3.9 0a.75.75 0 0 1 .712.787l-.275 5.5a.75.75 0 0 1-1.498-.075l.275-5.5a.75.75 0 0 1 .786-.711Z" clipRule="evenodd" /></svg>
                                        <span>Delete</span>
                                    </button>
                                </li>
                            </ul>
                        </motion.div>
                    )}
                </AnimatePresence>,
                document.body
            )}
        </div>
    );
};