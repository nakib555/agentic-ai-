/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect, useState, useMemo } from 'react';
import { motion as motionTyped, AnimatePresence } from 'framer-motion';
import { Virtuoso } from 'react-virtuoso';
import type { ChatSession } from '../../types';
import { HistoryItem } from './HistoryItem';
import { Skeleton } from '../UI/Skeleton';
import { isToday, isYesterday, isThisWeek, parseISO } from 'date-fns';

const motion = motionTyped as any;

type HistoryListProps = {
  history: ChatSession[];
  currentChatId: string | null;
  searchQuery: string;
  isCollapsed: boolean;
  isDesktop: boolean;
  isHistoryLoading: boolean;
  onLoadChat: (id: string) => void;
  onDeleteChat: (id: string) => void;
  onUpdateChatTitle: (id: string, title: string) => void;
};

type FlattenedItem = 
    | { type: 'header', id: string, title: string }
    | { type: 'item', id: string, data: ChatSession };

const groupChats = (chats: ChatSession[]): { [key: string]: ChatSession[] } => {
    const groups: { [key: string]: ChatSession[] } = {};

    chats.forEach(chat => {
        let groupKey: string;
        const date = new Date(chat.createdAt);
        
        if (isToday(date)) {
            groupKey = 'Today';
        } else if (isYesterday(date)) {
            groupKey = 'Yesterday';
        } else if (isThisWeek(date)) {
            groupKey = 'Previous 7 Days';
        } else {
            groupKey = date.toLocaleString('default', { month: 'long', year: 'numeric' });
        }

        if (!groups[groupKey]) {
            groups[groupKey] = [];
        }
        groups[groupKey].push(chat);
    });
    return groups;
};

const NoItems = ({ message, subtext }: { message: string, subtext?: string }) => (
    <div className="flex flex-col items-center justify-center text-center py-8 px-4 opacity-60">
        <div className="w-12 h-12 bg-slate-100 dark:bg-white/5 rounded-full flex items-center justify-center mb-3 text-slate-400">
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="w-6 h-6"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>
        </div>
        <p className="font-medium text-sm text-slate-600 dark:text-slate-300">{message}</p>
        {subtext && <p className="text-xs text-slate-500 dark:text-slate-500 mt-1">{subtext}</p>}
    </div>
);

const HistorySkeleton = () => (
    <div className="space-y-1 px-2">
        {[...Array(8)].map((_, i) => (
            <Skeleton key={i} className="h-9 w-full rounded-lg" />
        ))}
    </div>
);

const ChevronIcon = () => (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16" fill="currentColor" className="w-4 h-4 transition-transform">
        <path fillRule="evenodd" d="M6.22 4.22a.75.75 0 0 1 1.06 0l3.25 3.25a.75.75 0 0 1 0 1.06l-3.25 3.25a.75.75 0 0 1-1.06-1.06L8.94 8 6.22 5.28a.75.75 0 0 1 0-1.06Z" clipRule="evenodd" />
    </svg>
);

export const HistoryList = ({ history, currentChatId, searchQuery, isCollapsed, isDesktop, isHistoryLoading, onLoadChat, onDeleteChat, onUpdateChatTitle }: HistoryListProps) => {
    const filteredHistory = useMemo(() => history.filter(item =>
        item.title.toLowerCase().includes(searchQuery.toLowerCase())
    ), [history, searchQuery]);

    const { groupedHistory, groupOrder } = useMemo(() => {
        const groups = groupChats(filteredHistory);
        
        // Custom sort logic to ensure chronological grouping
        const order = Object.keys(groups).sort((a, b) => {
            const priorityMap: Record<string, number> = { 'Today': 0, 'Yesterday': 1, 'Previous 7 Days': 2 };
            const pA = priorityMap[a] ?? 3;
            const pB = priorityMap[b] ?? 3;
            if (pA !== pB) return pA - pB;
            
            // For months, parse date
            const dateA = new Date(a);
            const dateB = new Date(b);
            // Newer dates first
            return dateB.getTime() - dateA.getTime();
        });

        return { groupedHistory: groups, groupOrder: order };
    }, [filteredHistory]);
    
    const shouldCollapse = isDesktop && isCollapsed;

    const [collapsedGroups, setCollapsedGroups] = useState<Record<string, boolean>>(() => {
        try {
            const savedState = localStorage.getItem('chatHistoryGroups');
            return savedState ? JSON.parse(savedState) : {};
        } catch (e) {
            return {};
        }
    });

    useEffect(() => {
        try {
            localStorage.setItem('chatHistoryGroups', JSON.stringify(collapsedGroups));
        } catch (e) { /* ignore */ }
    }, [collapsedGroups]);

    const toggleGroup = (groupName: string) => {
        setCollapsedGroups(prev => ({
            ...prev,
            [groupName]: !prev[groupName],
        }));
    };

    // Flatten data for Virtuoso
    const flattenedData = useMemo(() => {
        const data: FlattenedItem[] = [];
        groupOrder.forEach(group => {
            const chats = groupedHistory[group];
            if (chats && chats.length > 0) {
                data.push({ type: 'header', id: `header-${group}`, title: group });
                
                if (!collapsedGroups[group] && !shouldCollapse) {
                    chats.forEach(chat => data.push({ type: 'item', id: chat.id, data: chat }));
                }
            }
        });
        return data;
    }, [groupedHistory, groupOrder, collapsedGroups, shouldCollapse]);

    if (isHistoryLoading) {
        return (
            <div className={`flex-1 min-h-0 text-sm ${!shouldCollapse ? 'overflow-hidden' : ''}`}>
                <HistorySkeleton />
            </div>
        );
    }

    return (
        <div className="flex-1 min-h-0 text-sm h-full w-full">
            {flattenedData.length > 0 ? (
                <Virtuoso
                    style={{ height: '100%', width: '100%' }}
                    data={flattenedData}
                    className="custom-scrollbar"
                    overscan={200}
                    itemContent={(index, item) => {
                        if (item.type === 'header') {
                            const isGroupCollapsed = collapsedGroups[item.title] ?? false;
                            return (
                                <div className="bg-layer-1 z-10 pt-4 pb-1">
                                    <button
                                        onClick={() => !shouldCollapse && toggleGroup(item.title)}
                                        disabled={shouldCollapse}
                                        className="w-full flex items-center justify-between px-2 text-[10px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500 hover:text-slate-600 dark:hover:text-slate-300 rounded py-1 transition-colors disabled:cursor-default"
                                        aria-expanded={!isGroupCollapsed}
                                    >
                                        <motion.span
                                            className="block overflow-hidden whitespace-nowrap"
                                            initial={false}
                                            animate={{ width: shouldCollapse ? 0 : 'auto', opacity: shouldCollapse ? 0 : 1, x: shouldCollapse ? -5 : 0 }}
                                            transition={{ duration: 0.2 }}
                                        >
                                            {item.title}
                                        </motion.span>
                                        
                                        <motion.div
                                            className={shouldCollapse ? 'hidden' : 'block'}
                                            animate={{ rotate: isGroupCollapsed ? 0 : 90 }}
                                            transition={{ duration: 0.2 }}
                                        >
                                            <ChevronIcon />
                                        </motion.div>
                                    </button>
                                </div>
                            );
                        }
                        
                        return (
                            <div className="mb-0.5 px-2">
                                <HistoryItem 
                                    text={item.data.title} 
                                    model={item.data.model}
                                    isCollapsed={isCollapsed}
                                    isDesktop={isDesktop}
                                    searchQuery={searchQuery}
                                    active={item.data.id === currentChatId}
                                    onClick={() => onLoadChat(item.data.id)}
                                    onDelete={() => onDeleteChat(item.data.id)}
                                    onUpdateTitle={(newTitle) => onUpdateChatTitle(item.data.id, newTitle)}
                                    isLoading={item.data.isLoading ?? false}
                                />
                            </div>
                        );
                    }}
                />
            ) : (
                !shouldCollapse && (
                    <NoItems 
                        message={searchQuery ? 'No conversations found' : 'No conversations yet'} 
                        subtext={searchQuery ? 'Try a different search term.' : 'Start a new chat to begin.'}
                    />
                )
            )}
        </div>
    );
};