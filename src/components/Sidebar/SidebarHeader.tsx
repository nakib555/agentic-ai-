
/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { motion as motionTyped } from 'framer-motion';
import { Logo } from '../UI/Logo'; 
import { Tooltip } from '../UI/Tooltip';
const motion = motionTyped as any;

const PanelLeftCloseIcon = () => (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-5 h-5">
        <rect width="18" height="18" x="3" y="3" rx="2" ry="2" />
        <line x1="9" x2="9" y1="3" y2="21" />
        <path d="m14 16-4-4 4-4" />
    </svg>
);

type SidebarHeaderProps = {
  isCollapsed: boolean;
  isDesktop: boolean;
  setIsOpen: (isOpen: boolean) => void;
  setIsCollapsed: (collapsed: boolean) => void;
};

export const SidebarHeader = ({ isCollapsed, isDesktop, setIsOpen, setIsCollapsed }: SidebarHeaderProps) => {
  // If isCollapsed is true on Desktop, this component is NOT rendered by SidebarContent. 
  // It is only rendered when the sidebar is OPEN.

  return (
    <div className="flex items-center justify-between px-4 mb-4 mt-3 flex-shrink-0">
      <div className="flex items-center gap-3 select-none">
          <div className="flex-shrink-0">
             <Logo className="w-8 h-8" />
          </div>
          
          <motion.span 
              className="font-bold text-xl text-slate-800 dark:text-slate-100 font-['Space_Grotesk'] tracking-tight whitespace-nowrap overflow-hidden"
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.3 }}
          >
              Gemini Chat
          </motion.span>
      </div>
      
      {/* Desktop Close Button */}
      {isDesktop && (
        <Tooltip content="Collapse Sidebar" position="right" delay={600}>
            <button
                onClick={() => setIsCollapsed(true)}
                className="p-1.5 rounded-lg text-slate-400 hover:bg-gray-200/50 dark:hover:bg-white/5 hover:text-slate-600 dark:hover:text-slate-200 transition-colors"
                aria-label="Collapse sidebar"
            >
                <PanelLeftCloseIcon />
            </button>
        </Tooltip>
      )}
      
      {/* Mobile Close Button */}
      {!isDesktop && (
          <button
              onClick={() => setIsOpen(false)}
              className="md:hidden p-2 -mr-2 text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-100 transition-colors"
              aria-label="Close sidebar"
          >
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-6 h-6"><path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" /></svg>
          </button>
      )}
    </div>
  );
};
