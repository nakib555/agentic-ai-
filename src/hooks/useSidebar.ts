
/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState, useMemo } from 'react';
import { useViewport } from './useViewport';

export const useSidebar = () => {
  const { isDesktop, isWideDesktop } = useViewport();
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);

  // This state will hold the user's explicit choice (true for collapsed, false for expanded).
  // `null` means the user hasn't made a choice yet, so we use automatic behavior.
  const [userCollapseChoice, setUserCollapseChoice] = useState<boolean | null>(() => {
    try {
        const savedState = localStorage.getItem('sidebarCollapsed');
        // If a value exists, parse it. Otherwise, it's null (auto).
        return savedState ? JSON.parse(savedState) : null;
    } catch (e) {
        console.warn('Failed to access localStorage for sidebarCollapsed:', e);
        return null;
    }
  });

  // The final collapsed state depends on user choice or screen size
  const isSidebarCollapsed = useMemo(() => {
    if (!isDesktop) {
        return false; // Sidebar is never "collapsed" on mobile, it's open or closed.
    }
    if (userCollapseChoice !== null) {
        return userCollapseChoice; // Respect the user's manual setting.
    }
    // Automatic behavior: collapse on medium screens, expand on wide screens.
    return !isWideDesktop;
  }, [isDesktop, isWideDesktop, userCollapseChoice]);
  
  const handleSetSidebarCollapsed = (collapsed: boolean) => {
    setUserCollapseChoice(collapsed); // Record user's choice
    try {
        localStorage.setItem('sidebarCollapsed', JSON.stringify(collapsed));
    } catch (e) { /* ignore write errors */ }
  };

  return {
    isSidebarOpen,
    setIsSidebarOpen,
    isSidebarCollapsed,
    handleSetSidebarCollapsed,
  };
};
