
/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useRef, useCallback, useLayoutEffect } from 'react';
import { createPortal } from 'react-dom';
import { AnimatePresence, motion as motionTyped } from 'framer-motion';
import type { Model } from '../../types';

const motion = motionTyped as any;

type ModelSelectorProps = {
  models: Model[];
  selectedModel: string;
  onModelChange: (modelId: string) => void;
  disabled?: boolean;
  className?: string;
  placeholder?: string;
  icon?: React.ReactNode;
};

// Default icons if none provided
const DefaultModelIcon = () => (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-5 h-5">
        <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"></path>
        <polyline points="3.27 6.96 12 12.01 20.73 6.96"></polyline>
        <line x1="12" y1="22.08" x2="12" y2="12"></line>
    </svg>
);

const CheckIcon = () => (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" className="w-3.5 h-3.5">
        <polyline points="20 6 9 17 4 12"></polyline>
    </svg>
);

export const ModelSelector: React.FC<ModelSelectorProps> = React.memo(({
  models,
  selectedModel,
  onModelChange,
  disabled,
  className = '',
  placeholder = "Select Model",
  icon
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const selectorRef = useRef<HTMLDivElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const selectedItemRef = useRef<HTMLButtonElement>(null);
  const selectedModelData = models.find(m => m.id === selectedModel);

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
    if (selectorRef.current) {
        const rect = selectorRef.current.getBoundingClientRect();
        const viewportWidth = window.innerWidth;
        const viewportHeight = window.innerHeight;
        const padding = 8; // Safety padding from screen edges

        // Vertical positioning logic
        const spaceBelow = viewportHeight - rect.bottom - padding;
        const spaceAbove = rect.top - padding;
        const desiredMaxHeight = 350; 
        
        // Use more available space if on mobile to maximize list visibility
        const isSmallScreen = viewportHeight < 600;
        
        // Prefer bottom, flip to top if cramped below (<200px) and more room above
        const showOnTop = spaceBelow < 200 && spaceAbove > spaceBelow;
        
        // Calculate max height based on available space, clamping to safe limits
        const availableHeight = showOnTop ? spaceAbove : spaceBelow;
        const maxHeight = Math.min(desiredMaxHeight, Math.max(100, availableHeight));

        // Width & Alignment Logic
        // 1. Min width: Match trigger width, but enforce ~200px floor for readability
        let minWidth = Math.max(rect.width, 200);
        
        // 2. Clamp minWidth if screen is extremely small (e.g. mobile portrait)
        if (minWidth > viewportWidth - (padding * 2)) {
            minWidth = viewportWidth - (padding * 2);
        }

        // 3. Determine Alignment (Left vs Right)
        // Check available space on both sides
        const spaceOnRight = viewportWidth - rect.left - padding;
        const spaceOnLeft = rect.right - padding;
        
        // Prefer left align (growing right) if space permits.
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
            maxHeight
        });
    }
  }, []);

  useLayoutEffect(() => {
    if (isOpen) {
        updatePosition(); // Initial position calculation
        
        // Auto-scroll to selected item
        if (selectedItemRef.current) {
            setTimeout(() => {
                selectedItemRef.current?.scrollIntoView({ block: 'center', behavior: 'instant' });
            }, 0);
        }
        
        const handleClickOutside = (event: MouseEvent) => {
            if (
                selectorRef.current && !selectorRef.current.contains(event.target as Node) &&
                menuRef.current && !menuRef.current.contains(event.target as Node)
            ) {
              setIsOpen(false);
            }
        };

        document.addEventListener('mousedown', handleClickOutside);
        window.addEventListener('resize', updatePosition);
        window.addEventListener('scroll', updatePosition, true); 
        
        return () => {
            document.removeEventListener('mousedown', handleClickOutside);
            window.removeEventListener('resize', updatePosition);
            window.removeEventListener('scroll', updatePosition, true);
        };
    }
  }, [isOpen, updatePosition]);

  const toggleOpen = () => {
    if (disabled) return;
    setIsOpen(prev => !prev);
  };

  const handleSelect = (modelId: string) => {
    onModelChange(modelId);
    setIsOpen(false);
  };

  return (
    <div className={`relative ${className}`} ref={selectorRef}>
      <button
        type="button"
        disabled={disabled}
        onClick={toggleOpen}
        className={`
            group w-full flex items-center justify-between gap-3 px-4 py-3 text-left
            bg-slate-100/50 dark:bg-white/5 border border-transparent
            rounded-xl transition-all duration-200 ease-out
            hover:bg-slate-100 dark:hover:bg-white/10
            focus:outline-none focus:ring-2 focus:ring-indigo-500/30
            disabled:opacity-50 disabled:cursor-not-allowed
            ${isOpen ? 'bg-white dark:bg-white/10 shadow-lg ring-1 ring-black/5 dark:ring-white/10' : ''}
        `}
      >
        <div className="flex items-center gap-3 min-w-0 flex-1">
            <div className={`
                flex items-center justify-center w-8 h-8 rounded-lg flex-shrink-0 transition-colors duration-200
                ${disabled 
                    ? 'text-slate-400 dark:text-slate-600' 
                    : 'text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-500/10'
                }
            `}>
                {icon || <DefaultModelIcon />}
            </div>
            <div className="flex flex-col min-w-0 flex-1">
                <span className={`text-sm font-semibold truncate ${selectedModelData ? 'text-slate-800 dark:text-slate-100' : 'text-slate-400 dark:text-slate-500'}`}>
                    {selectedModelData ? selectedModelData.name : placeholder}
                </span>
                {selectedModelData && (
                    <span className="text-[10px] font-medium text-slate-500 dark:text-slate-400 truncate">
                        {selectedModelData.id}
                    </span>
                )}
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
                    zIndex: 2000, 
                }}
                className="bg-white dark:bg-[#1a1a1a] border border-gray-200/50 dark:border-white/10 rounded-xl shadow-2xl overflow-hidden ring-1 ring-black/5"
            >
                <div 
                    className="overflow-y-auto custom-scrollbar p-1.5 space-y-0.5"
                    style={{ maxHeight: coords.maxHeight }}
                >
                    {models.length === 0 ? (
                        <div className="p-4 text-center">
                            <p className="text-xs font-medium text-slate-500 dark:text-slate-400">No models available</p>
                        </div>
                    ) : (
                        models.map((model) => {
                            const isSelected = selectedModel === model.id;
                            return (
                                <button
                                    key={model.id}
                                    ref={isSelected ? selectedItemRef : null}
                                    onClick={() => handleSelect(model.id)}
                                    className={`
                                        relative w-full flex items-center gap-3 p-2.5 rounded-lg text-left transition-all duration-200 group
                                        ${isSelected 
                                            ? 'bg-indigo-50 dark:bg-indigo-500/20' 
                                            : 'hover:bg-slate-100 dark:hover:bg-white/5'
                                        }
                                    `}
                                >
                                    <div className="flex-1 min-w-0">
                                        <div className="flex items-center justify-between gap-2">
                                            <span className={`text-sm font-medium truncate ${isSelected ? 'text-indigo-900 dark:text-indigo-100' : 'text-slate-700 dark:text-slate-200'}`}>
                                                {model.name}
                                            </span>
                                            {isSelected && (
                                                <div className="text-indigo-600 dark:text-indigo-400 flex-shrink-0">
                                                    <CheckIcon />
                                                </div>
                                            )}
                                        </div>
                                        <p className={`text-[10px] font-mono mt-0.5 truncate ${isSelected ? 'text-indigo-700/70 dark:text-indigo-300/70' : 'text-slate-400'}`}>
                                            {model.id}
                                        </p>
                                    </div>
                                </button>
                            );
                        })
                    )}
                </div>
            </motion.div>
            )}
        </AnimatePresence>,
        document.body
      )}
    </div>
  );
});
