
/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { Suspense, useState, useEffect, useRef } from 'react';
import { Panel, PanelGroup, PanelResizeHandle } from "react-resizable-panels";
import { useAppLogic } from '../../hooks/useAppLogic';
import { AppSkeleton } from '../UI/AppSkeleton';
import { ChatSkeleton } from '../UI/ChatSkeleton';
import { VersionMismatchOverlay } from '../UI/VersionMismatchOverlay';
import type { ChatSession } from '../../types';
import { DEFAULT_TEMPERATURE, DEFAULT_MAX_TOKENS } from './constants';

// Helper for safe lazy loading named exports
function lazyLoad<T extends React.ComponentType<any>>(
  importFactory: () => Promise<{ [key: string]: any }>,
  name: string
): React.LazyExoticComponent<T> {
  return React.lazy(() =>
    importFactory()
      .then((module) => {
        const component = module[name];
        if (!component) {
          throw new Error(`Module does not export component '${name}'`);
        }
        try { sessionStorage.removeItem(`reload_attempt_${name}`); } catch {}
        return { default: component };
      })
      .catch((error) => {
        const isChunkError = 
            error.message?.includes('Failed to fetch dynamically imported module') ||
            error.message?.includes('Importing a module script failed') ||
            error.message?.includes('error loading dynamically imported module') ||
            error.name === 'ChunkLoadError';

        if (isChunkError) {
             console.warn(`[LazyLoad] Chunk load failed for ${name}. Attempting recovery reload.`);
             const storageKey = `reload_attempt_${name}`;
             try {
                 if (!sessionStorage.getItem(storageKey)) {
                     sessionStorage.setItem(storageKey, 'true');
                     window.location.reload();
                     return new Promise(() => {});
                 }
             } catch (e) { /* ignore */ }
        }
        throw error;
      })
  );
}

// Lazy Load Major UI Blocks
const Sidebar = lazyLoad(() => import('../Sidebar/Sidebar'), 'Sidebar');
const ChatArea = lazyLoad(() => import('../Chat/ChatArea'), 'ChatArea');
const ChatHeader = lazyLoad(() => import('../Chat/ChatHeader'), 'ChatHeader');
const SourcesSidebar = lazyLoad(() => import('../AI/SourcesSidebar'), 'SourcesSidebar');
const ArtifactSidebar = lazyLoad(() => import('../Sidebar/ArtifactSidebar'), 'ArtifactSidebar');
const AppModals = lazyLoad(() => import('./AppModals'), 'AppModals');
const TestRunner = lazyLoad(() => import('../Testing'), 'TestRunner');

export const App = () => {
  const logic = useAppLogic();

  const currentChat = logic.currentChatId
    ? logic.chatHistory.find((c: ChatSession) => c.id === logic.currentChatId)
    : null;
  const chatTitle = currentChat ? currentChat.title : null;
  
  // --- Keyboard Detection Logic ---
  const [stableHeight, setStableHeight] = useState(typeof window !== 'undefined' ? window.innerHeight : 0);
  const widthRef = useRef(typeof window !== 'undefined' ? window.innerWidth : 0);
  const sidebarPanelRef = useRef<any>(null);

  useEffect(() => {
      const handleResize = () => {
          const currentH = window.innerHeight;
          const currentW = window.innerWidth;
          
          if (Math.abs(currentW - widthRef.current) > 50) {
              widthRef.current = currentW;
              setStableHeight(currentH);
              return;
          }

          setStableHeight(prev => {
              if (currentH > prev) return currentH;
              if (prev - currentH < (prev * 0.25)) return currentH;
              return prev;
          });
      };
      
      window.addEventListener('resize', handleResize);
      handleResize();
      
      return () => window.removeEventListener('resize', handleResize);
  }, []);

  const isKeyboardOpen = !logic.isDesktop && logic.visualViewportHeight < (stableHeight * 0.85);

  const hasApiKey = 
      (logic.provider === 'gemini' && !!logic.apiKey) || 
      (logic.provider === 'openrouter' && !!logic.openRouterApiKey) || 
      (logic.provider === 'ollama'); 

  // Synchronize Sidebar Panel state with Application State
  useEffect(() => {
    if (logic.isDesktop && sidebarPanelRef.current) {
        const panel = sidebarPanelRef.current;
        if (logic.isSidebarCollapsed) {
            if (!panel.isCollapsed()) panel.collapse();
        } else {
            if (panel.isCollapsed()) panel.expand();
        }
    }
  }, [logic.isDesktop, logic.isSidebarCollapsed]);

  // Handler for toggle button in ChatHeader
  const handleToggleSidebar = () => {
      if (logic.isDesktop) {
          // On Desktop, toggle collapse state via ref to ensure animation triggers
          if (sidebarPanelRef.current) {
              const panel = sidebarPanelRef.current;
              if (panel.isCollapsed()) {
                  panel.expand();
              } else {
                  panel.collapse();
              }
          }
      } else {
          // On Mobile, toggle open state overlay
          logic.handleToggleSidebar();
      }
  };

  const renderMainContent = () => (
    <div className="flex-1 flex flex-col w-full min-h-0 h-full bg-page transition-colors duration-300">
        <ChatHeader 
            isDesktop={logic.isDesktop}
            handleToggleSidebar={handleToggleSidebar}
            isSidebarOpen={logic.isSidebarOpen}
            isSidebarCollapsed={logic.isSidebarCollapsed}
            onImportChat={logic.handleImportChat}
            onExportChat={logic.handleExportChat}
            onShareChat={() => logic.handleShareChat()}
            isChatActive={logic.isChatActive}
            chatTitle={chatTitle}
        />
        <Suspense fallback={<ChatSkeleton />}>
            <ChatArea 
                messageListRef={logic.messageListRef}
                messages={logic.messages}
                isLoading={logic.isLoading}
                isHistoryLoading={logic.isHistoryLoading} // Pass explicit history loading state
                isAppLoading={logic.modelsLoading || logic.settingsLoading}
                sendMessage={logic.sendMessage}
                onCancel={logic.cancelGeneration}
                ttsVoice={logic.ttsVoice}
                ttsModel={logic.ttsModel}
                setTtsVoice={logic.setTtsVoice}
                currentChatId={logic.currentChatId}
                activeModel={logic.activeModel}
                provider={logic.provider}
                onShowSources={logic.handleShowSources}
                onRegenerate={logic.regenerateResponse}
                onSetActiveResponseIndex={logic.setActiveResponseIndex}
                backendStatus={logic.backendStatus}
                backendError={logic.backendError}
                onRetryConnection={logic.retryConnection}
                hasApiKey={hasApiKey}
                onEditMessage={logic.editMessage}
                onNavigateBranch={logic.navigateBranch}
            />
        </Suspense>
    </div>
  );

  return (
    <div 
        ref={logic.appContainerRef} 
        className={`flex h-full bg-page text-content-primary overflow-hidden ease-out`}
        style={{ 
            height: !logic.isDesktop && logic.visualViewportHeight ? `${logic.visualViewportHeight}px` : '100dvh',
            paddingTop: logic.isDesktop ? '0' : 'env(safe-area-inset-top)', 
            paddingBottom: logic.isDesktop || isKeyboardOpen ? '0' : 'env(safe-area-inset-bottom)',
        }}
    >
      {logic.versionMismatch && <VersionMismatchOverlay />}
      
      <Suspense fallback={<AppSkeleton />}>
        {logic.isDesktop ? (
            <PanelGroup direction="horizontal" autoSaveId="app-layout">
                <Panel 
                    defaultSize={20} 
                    minSize={15} 
                    maxSize={30} 
                    collapsible={true}
                    collapsedSize={4} // 4% width when collapsed (Mini Sidebar Rail)
                    onCollapse={() => logic.handleSetSidebarCollapsed(true)}
                    onExpand={() => logic.handleSetSidebarCollapsed(false)}
                    ref={sidebarPanelRef}
                    id="sidebar"
                    order={1}
                >
                    <Sidebar
                        isDesktop={true}
                        isOpen={logic.isSidebarOpen} 
                        setIsOpen={logic.setIsSidebarOpen}
                        isCollapsed={logic.isSidebarCollapsed}
                        setIsCollapsed={logic.handleSetSidebarCollapsed}
                        history={logic.chatHistory}
                        isHistoryLoading={logic.isHistoryLoading}
                        currentChatId={logic.currentChatId}
                        onNewChat={logic.startNewChat}
                        isNewChatDisabled={logic.isNewChatDisabled}
                        onLoadChat={logic.loadChat}
                        onDeleteChat={logic.handleDeleteChatRequest}
                        onUpdateChatTitle={logic.updateChatTitle}
                        onSettingsClick={() => logic.setIsSettingsOpen(true)}
                    />
                </Panel>
                
                <PanelResizeHandle className={`w-1 bg-transparent hover:bg-primary-main/50 transition-colors duration-200 focus:outline-none z-30 ${logic.isSidebarCollapsed ? 'hidden' : 'block'}`} />

                <Panel order={2} minSize={30}>
                    {renderMainContent()}
                </Panel>

                {(logic.isSourcesSidebarOpen || logic.isArtifactOpen) && (
                    <>
                        <PanelResizeHandle className="w-1 bg-transparent hover:bg-primary-main/50 transition-colors duration-200 focus:outline-none z-30" />
                        <Panel defaultSize={25} minSize={20} maxSize={40} order={3} id="right-sidebar">
                            {logic.isSourcesSidebarOpen ? (
                                <SourcesSidebar
                                    isOpen={logic.isSourcesSidebarOpen}
                                    onClose={logic.handleCloseSourcesSidebar}
                                    sources={logic.sourcesForSidebar}
                                />
                            ) : (
                                <ArtifactSidebar
                                    isOpen={logic.isArtifactOpen}
                                    onClose={() => logic.setIsArtifactOpen(false)}
                                    content={logic.artifactContent}
                                    language={logic.artifactLanguage}
                                />
                            )}
                        </Panel>
                    </>
                )}
            </PanelGroup>
        ) : (
            // Mobile Layout
            <>
                <Sidebar
                    isDesktop={false}
                    isOpen={logic.isSidebarOpen} 
                    setIsOpen={logic.setIsSidebarOpen}
                    isCollapsed={false} // Never collapsed on mobile
                    setIsCollapsed={() => {}}
                    history={logic.chatHistory}
                    isHistoryLoading={logic.isHistoryLoading}
                    currentChatId={logic.currentChatId}
                    onNewChat={logic.startNewChat}
                    isNewChatDisabled={logic.isNewChatDisabled}
                    onLoadChat={logic.loadChat}
                    onDeleteChat={logic.handleDeleteChatRequest}
                    onUpdateChatTitle={logic.updateChatTitle}
                    onSettingsClick={() => logic.setIsSettingsOpen(true)}
                />

                <main className="relative z-10 flex-1 flex flex-col min-w-0 h-full bg-page transition-colors duration-300">
                    {renderMainContent()}
                </main>

                <SourcesSidebar
                    isOpen={logic.isSourcesSidebarOpen}
                    onClose={logic.handleCloseSourcesSidebar}
                    sources={logic.sourcesForSidebar}
                />

                <ArtifactSidebar
                    isOpen={logic.isArtifactOpen}
                    onClose={() => logic.setIsArtifactOpen(false)}
                    content={logic.artifactContent}
                    language={logic.artifactLanguage}
                />
            </>
        )}

        <AppModals
          isDesktop={logic.isDesktop}
          isSettingsOpen={logic.isSettingsOpen}
          setIsSettingsOpen={logic.setIsSettingsOpen}
          isMemoryModalOpen={logic.isMemoryModalOpen}
          setIsMemoryModalOpen={logic.setIsMemoryModalOpen}
          isImportModalOpen={logic.isImportModalOpen}
          setIsImportModalOpen={logic.setIsImportModalOpen}
          handleFileUploadForImport={logic.handleFileUploadForImport}
          onRunTests={() => logic.setIsTestMode(true)}
          onDownloadLogs={logic.handleDownloadLogs}
          onShowDataStructure={logic.handleShowDataStructure}
          onExportAllChats={logic.handleExportAllChats}
          availableModels={logic.availableModels}
          availableImageModels={logic.availableImageModels}
          availableVideoModels={logic.availableVideoModels}
          availableTtsModels={logic.availableTtsModels}
          activeModel={logic.activeModel}
          onModelChange={logic.onModelChange}
          modelsLoading={logic.modelsLoading || logic.settingsLoading}
          clearAllChats={logic.handleRequestClearAll}
          apiKey={logic.apiKey}
          onSaveApiKey={logic.onSaveApiKey}
          aboutUser={logic.aboutUser}
          setAboutUser={logic.setAboutUser}
          aboutResponse={logic.aboutResponse}
          setAboutResponse={logic.setAboutResponse}
          temperature={logic.temperature}
          setTemperature={logic.setTemperature}
          maxTokens={logic.maxTokens}
          setMaxTokens={logic.setMaxTokens}
          imageModel={logic.imageModel}
          onImageModelChange={logic.onImageModelChange}
          videoModel={logic.videoModel}
          onVideoModelChange={logic.onVideoModelChange}
          ttsModel={logic.ttsModel}
          onTtsModelChange={logic.onTtsModelChange}
          defaultTemperature={DEFAULT_TEMPERATURE}
          defaultMaxTokens={DEFAULT_MAX_TOKENS}
          isMemoryEnabled={logic.isMemoryEnabled}
          setIsMemoryEnabled={logic.setIsMemoryEnabled}
          onManageMemory={logic.onManageMemory}
          memoryContent={logic.memoryContent}
          memoryFiles={logic.memoryFiles}
          clearMemory={logic.clearMemory}
          updateBackendMemory={logic.updateBackendMemory}
          updateMemoryFiles={logic.updateMemoryFiles}
          isConfirmationOpen={logic.isConfirmationOpen}
          memorySuggestions={logic.memorySuggestions}
          confirmMemoryUpdate={logic.confirmMemoryUpdate}
          cancelMemoryUpdate={logic.cancelMemoryUpdate}
          ttsVoice={logic.ttsVoice}
          setTtsVoice={logic.setTtsVoice}
          confirmation={logic.confirmation}
          onConfirm={logic.handleConfirm}
          onCancel={logic.handleCancel}
          theme={logic.theme}
          setTheme={logic.setTheme}
          serverUrl={logic.serverUrl}
          onSaveServerUrl={logic.onSaveServerUrl}
          provider={logic.provider}
          openRouterApiKey={logic.openRouterApiKey}
          ollamaApiKey={logic.ollamaApiKey}
          onProviderChange={logic.onProviderChange}
          ollamaHost={logic.ollamaHost}
          onSaveOllamaHost={logic.onSaveOllamaHost}
        />

        {logic.isTestMode && (
            <TestRunner 
                isOpen={logic.isTestMode}
                onClose={() => logic.setIsTestMode(false)}
                runTests={logic.runDiagnosticTests}
            />
        )}
      </Suspense>
    </div>
  );
};
