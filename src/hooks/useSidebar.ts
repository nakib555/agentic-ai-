
/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useCallback, useEffect } from 'react';
import { useViewport } from './useViewport';
import { useUIStore } from '../store/uiStore';

export const useSidebar = () => {
  const { isDesktop } = useViewport();
  const ui = useUIStore();
  
  // Desktop: Sidebar is a panel, defaulting to open (expanded)
  // We initialize from localStorage in a one-time effect or use the store's default
  useEffect(() => {
    try {
        const saved = localStorage.getItem('sidebarCollapsed');
        if (saved !== null) {
            ui.setSidebarCollapsed(JSON.parse(saved));
        }
    } catch (e) { /* ignore */ }
  }, []);

  // Persist desktop preference
  useEffect(() => {
    try {
        localStorage.setItem('sidebarCollapsed', JSON.stringify(ui.isSidebarCollapsed));
    } catch (e) { /* ignore */ }
  }, [ui.isSidebarCollapsed]);

  const toggleSidebar = useCallback(() => {
      if (isDesktop) {
          ui.setSidebarCollapsed(!ui.isSidebarCollapsed);
      } else {
          ui.setSidebarOpen(!ui.isSidebarOpen);
      }
  }, [isDesktop, ui.isSidebarCollapsed, ui.isSidebarOpen, ui.setSidebarCollapsed, ui.setSidebarOpen]);

  // Helper to force specific state (used by resize handles)
  const handleSetSidebarCollapsed = useCallback((collapsed: boolean) => {
      ui.setSidebarCollapsed(collapsed);
  }, [ui.setSidebarCollapsed]);

  return {
    isSidebarOpen: ui.isSidebarOpen,
    setIsSidebarOpen: ui.setSidebarOpen,
    isSidebarCollapsed: ui.isSidebarCollapsed,
    handleSetSidebarCollapsed,
    toggleSidebar
  };
};
