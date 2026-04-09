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
  
  // Artifact & Sources State
  isArtifactOpen: boolean;
  artifactContent: string;
  artifactLanguage: string;
  sourcesForSidebar: any[];
  isSourcesSidebarOpen: boolean;
  
  // Actions
  setSidebarOpen: (isOpen: boolean) => void;
  setSidebarCollapsed: (isCollapsed: boolean) => void;
  setSettingsOpen: (isOpen: boolean) => void;
  setMemoryModalOpen: (isOpen: boolean) => void;
  setImportModalOpen: (isOpen: boolean) => void;
  setTestMode: (isOpen: boolean) => void;

  setArtifactOpen: (isOpen: boolean) => void;
  setArtifactContent: (content: string) => void;
  setArtifactLanguage: (lang: string) => void;
  setSourcesForSidebar: (sources: any[]) => void;
  setSourcesSidebarOpen: (isOpen: boolean) => void;
}

export const useUIStore = create<UIState>((set) => ({
  isSidebarOpen: false,
  isSidebarCollapsed: false,
  isSettingsOpen: false,
  isMemoryModalOpen: false,
  isImportModalOpen: false,
  isTestMode: false,
  
  isArtifactOpen: false,
  artifactContent: '',
  artifactLanguage: 'text',
  sourcesForSidebar: [],
  isSourcesSidebarOpen: false,

  setSidebarOpen: (isSidebarOpen) => set({ isSidebarOpen }),
  setSidebarCollapsed: (isSidebarCollapsed) => set({ isSidebarCollapsed }),
  setSettingsOpen: (isSettingsOpen) => set({ isSettingsOpen }),
  setMemoryModalOpen: (isMemoryModalOpen) => set({ isMemoryModalOpen }),
  setImportModalOpen: (isImportModalOpen) => set({ isImportModalOpen }),
  setTestMode: (isTestMode) => set({ isTestMode }),

  setArtifactOpen: (isArtifactOpen) => set({ isArtifactOpen }),
  setArtifactContent: (artifactContent) => set({ artifactContent }),
  setArtifactLanguage: (artifactLanguage) => set({ artifactLanguage }),
  setSourcesForSidebar: (sourcesForSidebar) => set({ sourcesForSidebar }),
  setSourcesSidebarOpen: (isSourcesSidebarOpen) => set({ isSourcesSidebarOpen }),
}));
