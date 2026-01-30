
/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState, useCallback, useEffect } from 'react';
import { useViewport } from './useViewport';

export const useSidebar = () => {
  const { isDesktop } = useViewport();
  
  // Mobile: Sidebar is an overlay, defaulting to closed
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);

  // Desktop: Sidebar is a panel, defaulting to open (expanded)
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(() => {
    try {
        const saved = localStorage.getItem('sidebarCollapsed');
        return saved ? JSON.parse(saved) : false;
    } catch {
        return false;
    }
  });

  // Persist desktop preference
  useEffect(() => {
    try {
        localStorage.setItem('sidebarCollapsed', JSON.stringify(isSidebarCollapsed));
    } catch (e) { /* ignore */ }
  }, [isSidebarCollapsed]);

  const toggleSidebar = useCallback(() => {
      if (isDesktop) {
          setIsSidebarCollapsed((prev: boolean) => !prev);
      } else {
          setIsSidebarOpen((prev: boolean) => !prev);
      }
  }, [isDesktop]);

  // Helper to force specific state (used by resize handles)
  const handleSetSidebarCollapsed = useCallback((collapsed: boolean) => {
      setIsSidebarCollapsed(collapsed);
  }, []);

  return {
    isSidebarOpen,
    setIsSidebarOpen,
    isSidebarCollapsed,
    handleSetSidebarCollapsed,
    toggleSidebar
  };
};
