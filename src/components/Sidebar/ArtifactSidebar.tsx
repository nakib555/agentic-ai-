
/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useCallback, useLayoutEffect, useRef } from 'react';
import { motion as motionTyped, useDragControls, AnimatePresence, useMotionValue, animate, useTransform } from 'framer-motion';
import { useViewport } from '../../hooks/useViewport';
import { ArtifactContent } from './ArtifactContent';

const motion = motionTyped as any;

type ArtifactSidebarProps = {
    isOpen: boolean;
    onClose: () => void;
    content: string;
    language: string;
    width: number;
    setWidth: (width: number) => void;
    isResizing: boolean;
    setIsResizing: (isResizing: boolean) => void;
};

// No lazy loading needed for ArtifactContent as it's already code-split within itself via Sandpack lazy loading
// And ArtifactSidebar is already lazy loaded by App.

export const ArtifactSidebar: React.FC<ArtifactSidebarProps> = React.memo(({ 
    isOpen, onClose, content, language, width, setWidth, isResizing, setIsResizing 
}) => {
    const { isDesktop } = useViewport();
    const dragControls = useDragControls();
    
    // Mobile specific state
    const y = useMotionValue(typeof window !== 'undefined' ? window.innerHeight : 800);
    const contentRef = useRef<HTMLDivElement>(null);
    
    // Dynamic height calculation for mobile drag
    // Keeps the bottom of the content container anchored to the bottom of the screen
    // so scrollbars are always visible even when the sheet is dragged down (peeking).
    const maxSheetHeight = typeof window !== 'undefined' ? window.innerHeight * 0.85 : 800;
    const dynamicHeight = useTransform(y, (latestY) => {
        // When y=0 (fully open), height is max. When y increases (dragged down), height shrinks.
        // We clamp to avoid negative heights or excessive growth during rubber-banding.
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
            // Calculate dynamic height based on content, similar to FilePreviewSidebar
            const actualHeight = contentRef.current?.scrollHeight || 0;
            // Default to MAX_H for code artifacts which are usually dense, but allow shrinking if content is surprisingly small
            // We use a slightly more aggressive default for artifacts compared to files
            const targetHeight = Math.min(Math.max(actualHeight, MIN_H), MAX_H); 
            
            // For Artifacts, we often want full height code views, so we lean towards MAX_H if it's close
            const finalHeight = targetHeight > MAX_H * 0.8 ? MAX_H : targetHeight;
            
            const targetY = MAX_H - finalHeight;
            
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

    const startResizingHandler = useCallback((mouseDownEvent: React.MouseEvent) => {
        mouseDownEvent.preventDefault();
        setIsResizing(true);
        const handleMouseMove = (e: MouseEvent) => {
            const newWidth = window.innerWidth - e.clientX;
            setWidth(Math.max(300, Math.min(newWidth, window.innerWidth * 0.8)));
        };
        const handleMouseUp = () => {
            setIsResizing(false);
            window.removeEventListener('mousemove', handleMouseMove);
            window.removeEventListener('mouseup', handleMouseUp);
        };
        window.addEventListener('mousemove', handleMouseMove);
        window.addEventListener('mouseup', handleMouseUp);
    }, [setIsResizing, setWidth]);

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
                // Desktop uses width, Mobile uses Y via MotionValue
                animate={isDesktop ? { width: isOpen ? width : 0 } : undefined} 
                style={!isDesktop ? { y, height: '85dvh', maxHeight: '85dvh' } : { width }}
                transition={isDesktop ? { type: isResizing ? 'tween' : 'spring', stiffness: 300, damping: 30 } : undefined}
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
                // Ensure interactions are disabled when closed to prevent ghost clicks
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

                {/* Resize Handle (Desktop only) */}
                {isDesktop && (
                    <div
                        className="group absolute top-0 left-0 h-full z-50 w-4 cursor-col-resize flex justify-start hover:bg-transparent pl-[1px]"
                        onMouseDown={startResizingHandler}
                        // Hide handle when closed to prevent accidental drags
                        style={{ display: isOpen ? 'flex' : 'none' }}
                    >
                        <div className={`w-[2px] h-full transition-colors duration-200 ${isResizing ? 'bg-indigo-500' : 'bg-transparent group-hover:bg-indigo-400/50'}`}></div>
                    </div>
                )}
            </motion.aside>
        </>
    );
});
