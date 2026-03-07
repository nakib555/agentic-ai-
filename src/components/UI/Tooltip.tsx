/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { motion as motionTyped, AnimatePresence } from 'framer-motion';

const motion = motionTyped as any;

type TooltipPosition = 'top' | 'bottom' | 'left' | 'right';

interface TooltipProps {
  content: string;
  children: React.ReactElement;
  position?: TooltipPosition;
  delay?: number;
  className?: string;
  sideOffset?: number;
  disabled?: boolean;
}

export const Tooltip: React.FC<TooltipProps> = ({ 
  content, 
  children, 
  position = 'top', 
  delay = 400,
  className = '',
  sideOffset = 8,
  disabled = false
}) => {
  const [isVisible, setIsVisible] = useState(false);
  const [coords, setCoords] = useState({ top: 0, left: 0 });
  const triggerRef = useRef<HTMLElement | null>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const updatePosition = () => {
    if (!triggerRef.current) return;
    const rect = triggerRef.current.getBoundingClientRect();

    let top = 0;
    let left = 0;

    switch (position) {
      case 'top':
        top = rect.top - sideOffset;
        left = rect.left + rect.width / 2;
        break;
      case 'bottom':
        top = rect.bottom + sideOffset;
        left = rect.left + rect.width / 2;
        break;
      case 'left':
        top = rect.top + rect.height / 2;
        left = rect.left - sideOffset;
        break;
      case 'right':
        top = rect.top + rect.height / 2;
        left = rect.right + sideOffset;
        break;
    }

    setCoords({ top, left });
  };

  const handleMouseEnter = () => {
    // Mobile Adjustment: Disable tooltips on devices that don't support hover (e.g., touchscreens)
    // This prevents the "sticky tooltip" issue where tapping an element leaves the tooltip open.
    if (typeof window !== 'undefined' && window.matchMedia('(hover: none)').matches) {
        return;
    }

    if (disabled || !content) return;
    timerRef.current = setTimeout(() => {
      if (triggerRef.current) {
        updatePosition();
        setIsVisible(true);
      }
    }, delay);
  };

  const handleMouseLeave = () => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
    setIsVisible(false);
  };

  // Re-calculate position on scroll/resize if visible
  useEffect(() => {
    if (!isVisible) return;
    
    let rafId: number;
    const handleUpdate = () => {
        cancelAnimationFrame(rafId);
        rafId = requestAnimationFrame(() => {
            updatePosition();
        });
    };
    
    window.addEventListener('scroll', handleUpdate, true);
    window.addEventListener('resize', handleUpdate);
    
    return () => {
        cancelAnimationFrame(rafId);
        window.removeEventListener('scroll', handleUpdate, true);
        window.removeEventListener('resize', handleUpdate);
    };
  }, [isVisible]);

  // Clone element to attach event handlers and ref
  // We cast children to ReactElement<any> to ensure props access and cloneElement ref compatibility
  const childElement = children as React.ReactElement<any>;

  const trigger = React.cloneElement(childElement, {
    ref: (node: HTMLElement | null) => {
      triggerRef.current = node;
      // Handle existing refs if any
      const childRef = (childElement as any).ref;
      if (typeof childRef === 'function') {
        childRef(node);
      } else if (childRef && typeof childRef === 'object') {
        // Fix TS2540: Cast to MutableRefObject to allow assignment to current
        (childRef as React.MutableRefObject<any>).current = node;
      }
    },
    onMouseEnter: (e: React.MouseEvent) => {
        handleMouseEnter();
        if (childElement.props.onMouseEnter) childElement.props.onMouseEnter(e);
    },
    onMouseLeave: (e: React.MouseEvent) => {
        handleMouseLeave();
        if (childElement.props.onMouseLeave) childElement.props.onMouseLeave(e);
    },
    // Hide tooltip on click to prevent obstruction
    onClick: (e: React.MouseEvent) => {
        setIsVisible(false);
        if (childElement.props.onClick) childElement.props.onClick(e);
    }
  });

  return (
    <>
      {trigger}
      {createPortal(
        <AnimatePresence>
          {isVisible && (
            <motion.div
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9 }}
              transition={{ duration: 0.15 }}
              style={{
                position: 'fixed',
                top: coords.top,
                left: coords.left,
                zIndex: 10000, // Very high z-index
                pointerEvents: 'none',
              }}
            >
                <div 
                    className={`
                        px-2.5 py-1.5 bg-slate-800 dark:bg-slate-700 text-white dark:text-slate-100 text-xs font-medium rounded-md shadow-lg 
                        border border-slate-700/50 dark:border-slate-600/50 backdrop-blur-sm
                        whitespace-nowrap max-w-[90vw] overflow-hidden text-ellipsis
                        ${className}
                    `}
                    style={{
                        transform: 
                            position === 'top' ? 'translate(-50%, -100%)' :
                            position === 'bottom' ? 'translate(-50%, 0)' :
                            position === 'left' ? 'translate(-100%, -50%)' :
                            'translate(0, -50%)'
                    }}
                >
                    {content}
                </div>
            </motion.div>
          )}
        </AnimatePresence>,
        document.body
      )}
    </>
  );
};