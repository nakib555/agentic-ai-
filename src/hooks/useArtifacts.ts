/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useEffect, useCallback } from 'react';
import { useViewport } from './useViewport';
import { useUIStore } from '../store/uiStore';
import type { Source } from '../types';

export const useArtifacts = () => {
  const { isWideDesktop } = useViewport();
  const ui = useUIStore();

  const handleShowSources = useCallback((sources: Source[]) => {
    ui.setSourcesForSidebar(sources);
    ui.setSourcesSidebarOpen(true);
    if (!isWideDesktop) ui.setArtifactOpen(false);
  }, [isWideDesktop, ui]);

  const handleCloseSourcesSidebar = useCallback(() => ui.setSourcesSidebarOpen(false), [ui]);

  useEffect(() => {
    const handleOpenArtifact = (e: CustomEvent) => {
      const { code, language } = e.detail;
      ui.setArtifactContent(code);
      ui.setArtifactLanguage(language);
      ui.setArtifactOpen(true);
      if (!isWideDesktop) ui.setSourcesSidebarOpen(false);
    };
    window.addEventListener('open-artifact', handleOpenArtifact as EventListener);
    return () => window.removeEventListener('open-artifact', handleOpenArtifact as EventListener);
  }, [isWideDesktop, ui]);

  return {
    isArtifactOpen: ui.isArtifactOpen,
    setIsArtifactOpen: ui.setArtifactOpen,
    artifactContent: ui.artifactContent,
    artifactLanguage: ui.artifactLanguage,
    sourcesForSidebar: ui.sourcesForSidebar,
    isSourcesSidebarOpen: ui.isSourcesSidebarOpen,
    handleShowSources,
    handleCloseSourcesSidebar
  };
};
