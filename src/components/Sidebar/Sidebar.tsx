/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { Suspense } from 'react';
import { motion as motionTyped, AnimatePresence, useDragControls } from 'framer-motion';
import { useHotkeys } from 'react-hotkeys-hook'; // Integrated
import type { ChatSession } from '../../types';

const motion = motionTyped as any;

const SidebarContent = React.lazy(() => 
    import('./SidebarContent').then(module => ({ default: module.SidebarContent }))
);

const mobileVariants = {
    open: { x: '0%' },
    closed: { x: '-100%' },
};

type SidebarProps = {
    isOpen: boolean;
    setIsOpen: (isOpen: boolean) => void;
    isCollapsed: boolean;
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
    isDesktop: boolean;
};

export const Sidebar: React.FC<SidebarProps> = ({ 
    isOpen, setIsOpen, isCollapsed, setIsCollapsed, 
    history, isHistoryLoading, currentChatId, onNewChat, isNewChatDisabled, onLoadChat,
    onDeleteChat, onUpdateChatTitle, onSettingsClick,
    isDesktop
}) => {
    const dragControls = useDragControls();

    // Hotkey Integration
    useHotkeys('mod+k', (e) => {
        e.preventDefault();
        if (isDesktop) {
            setIsCollapsed(!isCollapsed);
        } else {
            setIsOpen(!isOpen);
        }
    }, [isDesktop, isCollapsed, isOpen]);
    
    useHotkeys('mod+j', (e) => {
        e.preventDefault();
        if (!isNewChatDisabled) onNewChat();
    }, [isNewChatDisabled, onNewChat]);

    const onDragEnd = (event: MouseEvent | TouchEvent | PointerEvent, info: any) => {
        if (!isDesktop) {
            if (info.offset.x < -100 || (info.velocity.x < -300 && info.offset.x < 0)) {
                setIsOpen(false);
            }
        }
    };

    return (
        <aside id="sidebar" className={`h-full flex-shrink-0 ${isDesktop ? 'relative z-20 w-full' : 'fixed inset-0 z-40 pointer-events-none'}`}>
            <AnimatePresence>
                {!isDesktop && isOpen && (
                    <motion.div 
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        transition={{ duration: 0.2 }}
                        onClick={() => setIsOpen(false)}
                        className="fixed inset-0 bg-black/40 pointer-events-auto" 
                        style={{ willChange: 'opacity' }}
                    />
                )}
            </AnimatePresence>
            
            <motion.div
                initial={false}
                animate={isDesktop ? undefined : (isOpen ? 'open' : 'closed')}
                variants={isDesktop ? undefined : mobileVariants}
                transition={{
                    type: 'spring',
                    stiffness: 300,
                    damping: 30,
                    mass: 0.8,
                }}
                drag={!isDesktop ? "x" : false}
                dragListener={!isDesktop} 
                dragControls={dragControls}
                dragConstraints={{ left: -1000, right: 0 }} 
                dragElastic={{ left: 0.5, right: 0 }} 
                onDragEnd={onDragEnd}
                style={!isDesktop ? {
                    height: '100%',
                    position: 'fixed',
                    width: '80%',
                    maxWidth: '340px',
                    left: 0,
                    top: 0,
                    bottom: 0,
                    pointerEvents: 'auto',
                    willChange: 'transform',
                    zIndex: 50,
                } : { height: '100%' }}
                className={`bg-layer-1 flex flex-col transform-gpu shadow-2xl md:shadow-none overflow-hidden h-full w-full ${
                    isDesktop ? 'border-r border-border' : 'border-r border-border'
                }`}
                onClick={(e: React.MouseEvent) => e.stopPropagation()}
            >
                <div 
                    className="p-3 flex flex-col h-full group min-h-0 relative w-full"
                    style={{ 
                        paddingBottom: !isDesktop ? 'calc(env(safe-area-inset-bottom) + 12px)' : '0.75rem', 
                        paddingTop: !isDesktop ? 'calc(env(safe-area-inset-top) + 12px)' : '0.75rem'
                    }}
                >
                    <Suspense fallback={
                        <div className="flex flex-col gap-4 p-4 animate-pulse">
                            <div className="h-8 bg-slate-200 dark:bg-white/5 rounded"></div>
                            <div className="h-10 bg-slate-200 dark:bg-white/5 rounded"></div>
                            <div className="h-40 bg-slate-200 dark:bg-white/5 rounded"></div>
                        </div>
                    }>
                        <SidebarContent 
                            isCollapsed={isCollapsed}
                            isDesktop={isDesktop}
                            setIsOpen={setIsOpen}
                            setIsCollapsed={setIsCollapsed}
                            history={history}
                            isHistoryLoading={isHistoryLoading}
                            currentChatId={currentChatId}
                            onNewChat={onNewChat}
                            isNewChatDisabled={isNewChatDisabled}
                            onLoadChat={onLoadChat}
                            onDeleteChat={onDeleteChat}
                            onUpdateChatTitle={onUpdateChatTitle}
                            onSettingsClick={onSettingsClick}
                        />
                    </Suspense>
                </div>
            </motion.div>
        </aside>
    );
};
