
/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useRef, useEffect, useCallback, useLayoutEffect } from 'react';
import { createPortal } from 'react-dom';
import { motion as motionTyped, AnimatePresence } from 'framer-motion';

const motion = motionTyped as any;

export const TTS_VOICES = [
    // Standard Personas
    { id: 'Puck', name: 'Puck', desc: 'Energetic & Clear' },
    { id: 'Charon', name: 'Charon', desc: 'Deep & Authoritative' },
    { id: 'Kore', name: 'Kore', desc: 'Calm & Soothing' },
    { id: 'Fenrir', name: 'Fenrir', desc: 'Strong & Resonant' },
    { id: 'Zephyr', name: 'Zephyr', desc: 'Soft & Gentle' },
    
    // International Accents / Styles
    { id: 'British', name: 'British', desc: 'Native UK Speaker' },
    { id: 'American', name: 'American', desc: 'Native US Speaker' },
    { id: 'French', name: 'French', desc: 'Native Français' },
    { id: 'Japanese', name: 'Japanese', desc: 'Native Nihongo' },
    { id: 'Chinese', name: 'Chinese', desc: 'Native Mandarin' },
    { id: 'German', name: 'German', desc: 'Native Deutsch' },
    { id: 'Spanish', name: 'Spanish', desc: 'Native Español' },
    { id: 'Italian', name: 'Italian', desc: 'Native Italiano' },
    { id: 'Russian', name: 'Russian', desc: 'Native Русский' },
    { id: 'Bengali', name: 'Bengali', desc: 'Native Bengali' },
    { id: 'Indonesian', name: 'Indonesian', desc: 'Native Bahasa' },
];

type VoiceSelectorProps = {
    selectedVoice: string;
    onVoiceChange: (voiceId: string) => void;
    disabled?: boolean;
    className?: string;
};

const CheckIcon = () => (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" className="w-3.5 h-3.5">
        <polyline points="20 6 9 17 4 12"></polyline>
    </svg>
);

export const VoiceSelector: React.FC<VoiceSelectorProps> = ({ 
    selectedVoice, 
    onVoiceChange, 
    disabled,
    className = ''
}) => {
    const [isOpen, setIsOpen] = useState(false);
    const containerRef = useRef<HTMLDivElement>(null);
    const menuRef = useRef<HTMLDivElement>(null);
    const selectedItemRef = useRef<HTMLButtonElement>(null);
    const selected = TTS_VOICES.find(v => v.id === selectedVoice) || TTS_VOICES[0];
    
    // State to calculate dynamic position
    const [coords, setCoords] = useState<{ 
        top?: number; 
        bottom?: number; 
        left?: number; 
        right?: number;
        minWidth: number;
        maxWidth: number;
        maxHeight: number;
    }>({ 
        minWidth: 0, 
        maxWidth: 0, 
        maxHeight: 300 
    });

    const updatePosition = useCallback(() => {
        if (containerRef.current) {
            const rect = containerRef.current.getBoundingClientRect();
            const viewportWidth = window.innerWidth;
            const viewportHeight = window.innerHeight;
            const padding = 8; // Safety padding

            // Vertical positioning logic
            const spaceBelow = viewportHeight - rect.bottom - padding;
            const spaceAbove = rect.top - padding;
            const desiredMaxHeight = 350; 
            
            // Prefer bottom, flip to top if cramped below (<200px) and more room above
            const showOnTop = spaceBelow < 200 && spaceAbove > spaceBelow;
            const maxHeight = Math.min(desiredMaxHeight, showOnTop ? spaceAbove : spaceBelow);

            // Width & Alignment Logic
            // 1. Min width: Match trigger width, but enforce ~240px floor for readability
            let minWidth = Math.max(rect.width, 240);
            
            // 2. Clamp minWidth if screen is extremely small
            if (minWidth > viewportWidth - (padding * 2)) {
                minWidth = viewportWidth - (padding * 2);
            }

            // 3. Determine Alignment (Left vs Right)
            const spaceOnRight = viewportWidth - rect.left - padding;
            const spaceOnLeft = rect.right - padding;
            
            const alignLeft = spaceOnRight >= minWidth || spaceOnRight > spaceOnLeft;

            let left: number | undefined;
            let right: number | undefined;
            let maxWidth: number;

            if (alignLeft) {
                left = rect.left;
                maxWidth = spaceOnRight;
            } else {
                right = viewportWidth - rect.right;
                maxWidth = spaceOnLeft;
            }

            setCoords({
                left,
                right,
                minWidth,
                maxWidth,
                top: showOnTop ? undefined : rect.bottom + 6,
                bottom: showOnTop ? viewportHeight - rect.top + 6 : undefined,
                maxHeight: Math.max(100, maxHeight)
            });
        }
    }, []);

    useLayoutEffect(() => {
        if (isOpen) {
            updatePosition();
            
            // Auto-scroll to selected item
            if (selectedItemRef.current) {
                setTimeout(() => {
                    selectedItemRef.current?.scrollIntoView({ block: 'center', behavior: 'instant' });
                }, 0);
            }

            const handleClickOutside = (event: MouseEvent) => {
                if (
                    containerRef.current && !containerRef.current.contains(event.target as Node) &&
                    menuRef.current && !menuRef.current.contains(event.target as Node)
                ) {
                    setIsOpen(false);
                }
            };

            let rafId: number;
            const handleUpdate = () => {
                cancelAnimationFrame(rafId);
                rafId = requestAnimationFrame(() => {
                    updatePosition();
                });
            };

            document.addEventListener('mousedown', handleClickOutside);
            window.addEventListener('resize', handleUpdate);
            window.addEventListener('scroll', handleUpdate, true);
            
            return () => {
                cancelAnimationFrame(rafId);
                document.removeEventListener('mousedown', handleClickOutside);
                window.removeEventListener('resize', handleUpdate);
                window.removeEventListener('scroll', handleUpdate, true);
            };
        }
    }, [isOpen, updatePosition]);

    const toggleOpen = () => {
        if (disabled) return;
        setIsOpen(prev => !prev);
    };

    // Split voices into groups
    const personas = TTS_VOICES.slice(0, 5);
    const accents = TTS_VOICES.slice(5);

    const renderVoiceItem = (voice: typeof TTS_VOICES[0]) => {
        const isSelected = selectedVoice === voice.id;
        return (
            <button
                type="button"
                key={voice.id}
                ref={isSelected ? selectedItemRef : null}
                onClick={(e) => {
                    e.stopPropagation();
                    onVoiceChange(voice.id);
                    setIsOpen(false);
                }}
                className={`
                    relative w-full flex items-center gap-3 p-2.5 rounded-lg text-left transition-all duration-200 group
                    ${isSelected 
                        ? 'bg-indigo-50 dark:bg-indigo-500/20' 
                        : 'hover:bg-slate-100 dark:hover:bg-white/5'
                    }
                `}
            >
                <div className={`
                    w-8 h-8 rounded-lg flex items-center justify-center text-xs font-bold transition-colors flex-shrink-0
                    ${isSelected 
                        ? 'bg-indigo-100 text-indigo-700 dark:bg-indigo-500/40 dark:text-indigo-200' 
                        : 'bg-slate-100 text-slate-500 dark:bg-white/10 dark:text-slate-400'
                    }
                `}>
                    {voice.name[0]}
                </div>
                <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-2">
                        <span className={`text-sm font-medium truncate ${isSelected ? 'text-indigo-900 dark:text-indigo-100' : 'text-slate-700 dark:text-slate-200'}`}>
                            {voice.name}
                        </span>
                        {isSelected && (
                            <div className="text-indigo-600 dark:text-indigo-400 flex-shrink-0">
                                <CheckIcon />
                            </div>
                        )}
                    </div>
                    <p className={`text-[10px] font-medium truncate ${isSelected ? 'text-indigo-700/70 dark:text-indigo-300/70' : 'text-slate-400'}`}>
                        {voice.desc}
                    </p>
                </div>
            </button>
        );
    };

    return (
        <div className={`relative ${className}`} ref={containerRef}>
            <button
                type="button"
                onClick={toggleOpen}
                disabled={disabled}
                className={`
                    group w-full flex items-center justify-between gap-3 px-4 py-3 text-left
                    bg-slate-100/50 dark:bg-white/5 border border-transparent
                    rounded-xl transition-all duration-200 ease-out
                    hover:bg-slate-100 dark:hover:bg-white/10
                    focus:outline-none focus:ring-2 focus:ring-indigo-500/30
                    disabled:opacity-50 disabled:cursor-not-allowed
                    ${isOpen ? 'bg-white dark:bg-white/10 shadow-lg ring-1 ring-black/5 dark:ring-white/10' : ''}
                `}
                title="Select Voice Persona"
            >
                <div className="flex items-center gap-3 min-w-0 flex-1">
                    <div className={`
                        flex items-center justify-center w-8 h-8 rounded-lg flex-shrink-0 transition-colors duration-200
                        ${disabled 
                            ? 'bg-slate-200 dark:bg-white/5 text-slate-400 dark:text-slate-600' 
                            : 'bg-indigo-50 dark:bg-indigo-500/10 text-indigo-600 dark:text-indigo-400'
                        }
                    `}>
                        <span className="text-xs font-bold">{selected.name[0]}</span>
                    </div>
                    <div className="flex flex-col min-w-0 flex-1">
                        <span className={`text-sm font-semibold truncate ${selected ? 'text-slate-800 dark:text-slate-100' : 'text-slate-400 dark:text-slate-500'}`}>
                            {selected.name}
                        </span>
                        <span className="text-[10px] font-medium text-slate-500 dark:text-slate-400 truncate">
                            {selected.desc}
                        </span>
                    </div>
                </div>

                <div className={`
                    text-slate-400 transition-transform duration-300
                    ${isOpen ? 'rotate-180 text-indigo-500' : 'group-hover:text-slate-600 dark:group-hover:text-slate-300'}
                `}>
                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4">
                        <path d="m6 9 6 6 6-6"/>
                    </svg>
                </div>
            </button>

            {createPortal(
                <AnimatePresence>
                    {isOpen && (
                        <motion.div
                            ref={menuRef}
                            initial={{ opacity: 0, scale: 0.95, y: coords.bottom ? 5 : -5 }}
                            animate={{ opacity: 1, scale: 1, y: 0 }}
                            exit={{ opacity: 0, scale: 0.95, y: coords.bottom ? 5 : -5 }}
                            transition={{ duration: 0.1, ease: "easeOut" }}
                            style={{
                                position: 'fixed',
                                left: coords.left,
                                right: coords.right,
                                minWidth: coords.minWidth,
                                maxWidth: coords.maxWidth,
                                top: coords.top,
                                bottom: coords.bottom,
                                zIndex: 99999,
                            }}
                            className="bg-white dark:bg-[#1a1a1a] border border-gray-200/50 dark:border-white/10 rounded-xl shadow-2xl overflow-hidden ring-1 ring-black/5"
                        >
                            <div 
                                className="overflow-y-auto custom-scrollbar"
                                style={{ maxHeight: coords.maxHeight }}
                            >
                                <div className="p-1.5 flex flex-col gap-0.5">
                                    <div className="px-2 py-1.5 text-[10px] font-bold text-slate-400 uppercase tracking-wider select-none">
                                        Gemini Personas
                                    </div>
                                    {personas.map(renderVoiceItem)}
                                    
                                    <div className="mt-2 px-2 py-1.5 text-[10px] font-bold text-slate-400 uppercase tracking-wider select-none border-t border-gray-100 dark:border-white/5 pt-3">
                                        Native & International
                                    </div>
                                    {accents.map(renderVoiceItem)}
                                </div>
                            </div>
                        </motion.div>
                    )}
                </AnimatePresence>,
                document.body
            )}
        </div>
    );
};
