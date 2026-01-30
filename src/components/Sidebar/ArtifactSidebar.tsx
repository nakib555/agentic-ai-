
/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useLayoutEffect, useRef } from 'react';
import { motion as motionTyped, useDragControls, AnimatePresence, useMotionValue, animate, useTransform } from 'framer-motion';
import { useViewport } from '../../hooks/useViewport';
import { ArtifactContent } from './ArtifactContent';

const motion = motionTyped as any;

type ArtifactSidebarProps = {
    isOpen: boolean;
    onClose: () => void;
    content: string;
    language: string;
};

export const ArtifactSidebar: React.FC<ArtifactSidebarProps> = React.memo(({ 
    isOpen, onClose, content, language
}) => {
    const { isDesktop } = useViewport();
    const dragControls = useDragControls();
    
    // Mobile specific state
    const y = useMotionValue(typeof window !== 'undefined' ? window.innerHeight : 800);
    const contentRef = useRef<HTMLDivElement>(null);
    
    // Dynamic height calculation for mobile drag
    const maxSheetHeight = typeof window !== 'undefined' ? window.innerHeight * 0.85 : 800;
    const dynamicHeight = useTransform(y, (latestY) => {
        const calculated = maxSheetHeight - latestY;
        return Math.max(100, Math.min(calculated, maxSheetHeight)); 
    });

    // Mobile Sheet Logic: Calculate optimal height and animate
    useLayoutEffect(() => {
        if (isDesktop) return;

        const vh = window.innerHeight;
        // Mobile layout constants
        const MAX_H = vh * 0.85; 
        const MIN_H = vh * 0.45;

        if (isOpen) {
            // Mobile: Always slide to Max height (0 offset) for full view
            const targetY = 0;
            
            animate(y, targetY, { type: "spring", damping: 30, stiffness: 300 });
        } else {
            // Slide completely off screen
            animate(y, MAX_H, { type: "spring", damping: 30, stiffness: 300 });
        }
    }, [isOpen, isDesktop, y, content, language]);

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
            // Snap to Max (Full 85vh)
            animate(y, 0, { type: "spring", damping: 30, stiffness: 300 });
        } else {
            // Snap to Min (45vh)
            animate(y, MAX_H - MIN_H, { type: "spring", damping: 30, stiffness: 300 });
        }
    };

    // Safety check for initialization
    if (!content && !isOpen) return null;

    return (
        <>
            {/* Backdrop for Mobile */}
            <AnimatePresence>
                {!isDesktop && isOpen && (
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        onClick={onClose}
                        className="fixed inset-0 bg-black/40 z-[60]"
                    />
                )}
            </AnimatePresence>

            <motion.aside
                initial={false}
                style={!isDesktop ? { y, height: '85dvh', maxHeight: '85dvh' } : { height: '100%', width: '100%' }}
                drag={!isDesktop ? "y" : false}
                dragListener={false} // Manual control via drag handle
                dragControls={dragControls}
                dragConstraints={{ top: 0, bottom: (typeof window !== 'undefined' ? window.innerHeight * 0.85 : 800) }}
                dragElastic={{ top: 0, bottom: 0.2 }}
                onDragEnd={onDragEnd}
                className={`
                    flex-shrink-0 bg-layer-1 border-l border-border-subtle overflow-hidden flex flex-col shadow-2xl
                    ${isDesktop 
                        ? 'relative h-full z-30' 
                        : 'fixed inset-x-0 bottom-0 z-[70] border-t rounded-t-2xl'
                    }
                `}
                aria-hidden={!isOpen}
            >
                <motion.div 
                    ref={contentRef}
                    className="flex flex-col overflow-hidden w-full relative"
                    style={{ height: isDesktop ? '100%' : dynamicHeight }}
                >
                    {/* Drag handle for mobile */}
                    {!isDesktop && (
                        <div 
                            className="flex justify-center pt-3 pb-1 flex-shrink-0 bg-layer-1 cursor-grab active:cursor-grabbing touch-none w-full" 
                            onPointerDown={(e: any) => dragControls.start(e)}
                            style={{ touchAction: 'none' }}
                            aria-hidden="true"
                        >
                            <div className="h-1.5 w-12 bg-gray-300 dark:bg-slate-700 rounded-full"></div>
                        </div>
                    )}

                    <ArtifactContent 
                        content={content}
                        language={language}
                        onClose={onClose}
                    />
                </motion.div>
            </motion.aside>
        </>
    );
});
