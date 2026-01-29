
/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useRef, useLayoutEffect, Suspense } from 'react';
import { motion as motionTyped, useDragControls, AnimatePresence, useMotionValue, animate } from 'framer-motion';
import type { Source } from '../../types';
import { useViewport } from '../../hooks/useViewport';

const motion = motionTyped as any;

// Safe lazy load
const SourcesContent = React.lazy(() => 
    import('./SourcesContent').then(m => ({ default: m.SourcesContent }))
);

type SourcesSidebarProps = {
    isOpen: boolean;
    onClose: () => void;
    sources: Source[];
};

export const SourcesSidebar: React.FC<SourcesSidebarProps> = ({ isOpen, onClose, sources }) => {
    const { isDesktop } = useViewport();
    const dragControls = useDragControls();
    const contentRef = useRef<HTMLDivElement>(null);
    const y = useMotionValue(typeof window !== 'undefined' ? window.innerHeight : 800);

    // Mobile Sheet Logic: Calculate optimal height and animate
    useLayoutEffect(() => {
        if (isDesktop) return;

        const vh = window.innerHeight;
        const MAX_H = vh * 0.85; 
        const MIN_H = vh * 0.45;

        if (isOpen) {
            // Assume 50px per item approx
            const estimatedHeight = (sources?.length || 0) * 60 + 60; 
            const targetHeight = Math.min(Math.max(estimatedHeight, MIN_H), MAX_H);
            const targetY = MAX_H - targetHeight;
            
            animate(y, targetY, { type: "spring", damping: 30, stiffness: 300 });
        } else {
            animate(y, MAX_H, { type: "spring", damping: 30, stiffness: 300 });
        }
    }, [isOpen, isDesktop, sources, y]);

    const onDragEnd = (event: MouseEvent | TouchEvent | PointerEvent, info: any) => {
        if (isDesktop) return;

        const vh = window.innerHeight;
        const MAX_H = vh * 0.85;
        const MIN_H = vh * 0.45;
        const currentY = y.get();
        const velocityY = info.velocity.y;

        const closingThreshold = MAX_H - (MIN_H / 2);

        if (velocityY > 300 || currentY > closingThreshold) {
            onClose();
        } else if (currentY < (MAX_H - MIN_H) / 2) {
            // Snap to Max
            animate(y, 0, { type: "spring", damping: 30, stiffness: 300 });
        } else {
            // Snap to Min
            animate(y, MAX_H - MIN_H, { type: "spring", damping: 30, stiffness: 300 });
        }
    };

    if (!isDesktop && !isOpen) return null;

    return (
        <>
            <AnimatePresence>
                {!isDesktop && isOpen && (
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        onClick={onClose}
                        className="fixed inset-0 z-40 bg-black/40 backdrop-blur-[2px]"
                        aria-hidden="true"
                    />
                )}
            </AnimatePresence>
            <motion.aside
                initial={false}
                style={!isDesktop ? { y, height: '85vh', maxHeight: '85vh' } : { height: '100%', width: '100%' }}
                drag={!isDesktop ? "y" : false}
                dragListener={false}
                dragControls={dragControls}
                dragConstraints={{ top: 0, bottom: (typeof window !== 'undefined' ? window.innerHeight * 0.85 : 800) }}
                dragElastic={{ top: 0, bottom: 0.2 }}
                onDragEnd={onDragEnd}
                className={`
                    flex-shrink-0 overflow-hidden bg-white dark:bg-[#09090b]
                    ${isDesktop 
                        ? 'relative border-l border-gray-200 dark:border-white/10' 
                        : 'fixed inset-x-0 bottom-0 z-50 border-t border-gray-200 dark:border-white/10 rounded-t-2xl shadow-[0_-8px_30px_rgba(0,0,0,0.12)]'
                    }
                `}
                role="complementary"
                aria-labelledby="sources-sidebar-title"
            >
                <div 
                    ref={contentRef}
                    className="flex flex-col h-full overflow-hidden w-full"
                >
                    {/* Drag handle for mobile */}
                    {!isDesktop && (
                        <div 
                            className="flex justify-center pt-3 pb-1 cursor-grab active:cursor-grabbing touch-none w-full" 
                            onPointerDown={(e: any) => dragControls.start(e)}
                            aria-hidden="true"
                        >
                            <div className="h-1.5 w-12 bg-gray-300 dark:bg-slate-600 rounded-full"></div>
                        </div>
                    )}

                    <div className={`flex items-center justify-between px-4 pb-3 ${isDesktop ? 'pt-4' : 'pt-2'} border-b border-gray-200 dark:border-white/10 flex-shrink-0 w-full`}>
                        <h2 id="sources-sidebar-title" className="text-lg font-bold text-gray-800 dark:text-slate-100">Sources</h2>
                        <button onClick={onClose} className="p-1.5 rounded-full text-gray-500 dark:text-slate-400 hover:bg-gray-200/50 dark:hover:bg-black/20 transition-colors" aria-label="Close sources">
                            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-5 h-5">
                                <line x1="18" y1="6" x2="6" y2="18"></line>
                                <line x1="6" y1="6" x2="18" y2="18"></line>
                            </svg>
                        </button>
                    </div>

                    <Suspense fallback={
                        <div className="flex items-center justify-center h-full">
                            <div className="animate-spin rounded-full h-6 w-6 border-2 border-indigo-500 border-t-transparent"></div>
                        </div>
                    }>
                        <SourcesContent sources={sources} />
                    </Suspense>
                </div>
            </motion.aside>
        </>
    );
};
