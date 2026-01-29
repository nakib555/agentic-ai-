
/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState, useEffect } from 'react';

const DESKTOP_BREAKPOINT = 768; // Tailwind's 'md' breakpoint
const WIDE_DESKTOP_BREAKPOINT = 1280; // Tailwind's 'lg' breakpoint

/**
 * A custom hook that tracks viewport size categories.
 * @returns An object containing `isDesktop`, `isWideDesktop`, and `visualViewportHeight`.
 */
export const useViewport = () => {
    const [isDesktop, setIsDesktop] = useState(typeof window !== 'undefined' ? window.innerWidth >= DESKTOP_BREAKPOINT : true);
    const [isWideDesktop, setIsWideDesktop] = useState(typeof window !== 'undefined' ? window.innerWidth >= WIDE_DESKTOP_BREAKPOINT : true);
    const [visualViewportHeight, setVisualViewportHeight] = useState(typeof window !== 'undefined' ? (window.visualViewport?.height || window.innerHeight) : 0);

    useEffect(() => {
        const handleResize = () => {
            setIsDesktop(window.innerWidth >= DESKTOP_BREAKPOINT);
            setIsWideDesktop(window.innerWidth >= WIDE_DESKTOP_BREAKPOINT);
        };

        const handleVisualResize = () => {
             // We only care about this on mobile where virtual keyboards affect layout
             if (window.visualViewport && window.innerWidth < DESKTOP_BREAKPOINT) {
                 const activeElement = document.activeElement;
                 const newHeight = window.visualViewport.height;

                 // Only trigger the specific viewport resizing logic if the main chat input is focused.
                 if (activeElement && activeElement.id === 'main-chat-input') {
                     // Check for significant change (>1px) to avoid micro-jitters
                     setVisualViewportHeight(prev => Math.abs(prev - newHeight) > 1 ? newHeight : prev);
                 } else {
                     // If focus is elsewhere, disable the app container shrinking.
                     setVisualViewportHeight(0);
                 }
             }
        };

        // Aggressively prevent window scrolling on mobile (fixes "drag to up" issue)
        const handleScroll = () => {
             if (window.innerWidth < DESKTOP_BREAKPOINT && (window.scrollY !== 0 || window.scrollX !== 0)) {
                 window.scrollTo(0, 0);
             }
        };

        window.addEventListener('resize', handleResize);
        window.addEventListener('scroll', handleScroll);
        
        // Visual Viewport API for accurate mobile layout with keyboard
        if (window.visualViewport) {
            window.visualViewport.addEventListener('resize', handleVisualResize);
            // Initial read - assume normal full height on load (0 -> 100dvh fallback)
            if (window.innerWidth < DESKTOP_BREAKPOINT) {
                setVisualViewportHeight(0);
            }
        }
        
        return () => {
            window.removeEventListener('resize', handleResize);
            window.removeEventListener('scroll', handleScroll);
            if (window.visualViewport) {
                window.visualViewport.removeEventListener('resize', handleVisualResize);
            }
        };
    }, []); 

    return { isDesktop, isWideDesktop, visualViewportHeight };
};
