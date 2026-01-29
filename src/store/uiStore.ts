/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { create } from 'zustand';

interface UIState {
  isSidebarOpen: boolean;
  isSidebarCollapsed: boolean;
  isSettingsOpen: boolean;
  isMemoryModalOpen: boolean;
  isImportModalOpen: boolean;
  isTestMode: boolean;
  
  // Actions
  setSidebarOpen: (isOpen: boolean) => void;
  setSidebarCollapsed: (isCollapsed: boolean) => void;
  setSettingsOpen: (isOpen: boolean) => void;
  setMemoryModalOpen: (isOpen: boolean) => void;
  setImportModalOpen: (isOpen: boolean) => void;
  setTestMode: (isOpen: boolean) => void;
  toggleSidebar: () => void;
}

export const useUIStore = create<UIState>((set) => ({
  isSidebarOpen: false,
  isSidebarCollapsed: false,
  isSettingsOpen: false,
  isMemoryModalOpen: false,
  isImportModalOpen: false,
  isTestMode: false,

  setSidebarOpen: (isSidebarOpen) => set({ isSidebarOpen }),
  setSidebarCollapsed: (isSidebarCollapsed) => set({ isSidebarCollapsed }),
  setSettingsOpen: (isSettingsOpen) => set({ isSettingsOpen }),
  setMemoryModalOpen: (isMemoryModalOpen) => set({ isMemoryModalOpen }),
  setImportModalOpen: (isImportModalOpen) => set({ isImportModalOpen }),
  setTestMode: (isTestMode) => set({ isTestMode }),
  toggleSidebar: () => set((state) => ({ isSidebarOpen: !state.isSidebarOpen })),
}));