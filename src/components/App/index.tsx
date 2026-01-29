/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { Suspense, useState, useEffect, useRef } from 'react';
import { useAppLogic } from './useAppLogic';
import { AppSkeleton } from '../UI/AppSkeleton';
import { ChatSkeleton } from '../UI/ChatSkeleton';
import {
  DEFAULT_TEMPERATURE, DEFAULT_MAX_TOKENS
} from './constants';
import { VersionMismatchOverlay } from '../UI/VersionMismatchOverlay';
import type { ChatSession } from '../../types';

// Helper for safe lazy loading named exports with auto-reload logic for chunks
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
        // Cleanup reload flag on successful load
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
  
  const activeMessage = currentChat?.messages?.length ? currentChat.messages[currentChat.messages.length - 1] : null;

  // --- Keyboard Detection Logic ---
  const [stableHeight, setStableHeight] = useState(typeof window !== 'undefined' ? window.innerHeight : 0);
  const widthRef = useRef(typeof window !== 'undefined' ? window.innerWidth : 0);

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

  // Determine if we have a valid configuration to start chatting
  // For Ollama, we assume it's ready if provider is selected (default host is used).
  const hasApiKey = 
      (logic.provider === 'gemini' && !!logic.apiKey) || 
      (logic.provider === 'openrouter' && !!logic.openRouterApiKey) || 
      (logic.provider === 'ollama'); 

  return (
    <div 
        ref={logic.appContainerRef} 
        // Removed transition-[height] and duration-200 to prevent jank on mobile keyboard open/close
        className={`flex h-full bg-page text-content-primary overflow-hidden ease-out ${logic.isAnyResizing ? 'pointer-events-none' : ''}`}
        style={{ 
            height: !logic.isDesktop && logic.visualViewportHeight ? `${logic.visualViewportHeight}px` : '100dvh',
            paddingTop: logic.isDesktop ? '0' : 'env(safe-area-inset-top)', 
            paddingBottom: logic.isDesktop || isKeyboardOpen ? '0' : 'env(safe-area-inset-bottom)',
        }}
    >
      {logic.versionMismatch && <VersionMismatchOverlay />}
      
      <Suspense fallback={<AppSkeleton />}>
        <Sidebar
          key={logic.isDesktop ? 'desktop' : 'mobile'}
          isDesktop={logic.isDesktop}
          isOpen={logic.isSidebarOpen} 
          setIsOpen={logic.setIsSidebarOpen}
          isCollapsed={logic.isSidebarCollapsed}
          setIsCollapsed={logic.handleSetSidebarCollapsed}
          width={logic.sidebarWidth}
          setWidth={logic.handleSetSidebarWidth}
          isResizing={logic.isResizing}
          setIsResizing={logic.setIsResizing}
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

        <main 
            className="relative z-10 flex-1 flex flex-col min-w-0 h-full bg-page transition-colors duration-300"
        >
          {!logic.isDesktop && (
            <div className="absolute top-0 left-0 right-0 z-30 pointer-events-none px-4 py-3">
               <div className="h-11 flex items-center">
                 {!logic.isSidebarOpen && (
                  <button
                    onClick={() => logic.setIsSidebarOpen(true)}
                    className="pointer-events-auto p-2 rounded-lg bg-layer-1/80 backdrop-blur-md border border-border text-content-secondary hover:text-content-primary shadow-sm"
                    aria-label="Open sidebar"
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="3" y1="12" x2="21" y2="12"></line><line x1="3" y1="6" x2="21" y2="6"></line><line x1="3" y1="18" x2="21" y2="18"></line></svg>
                  </button>
                 )}
               </div>
            </div>
          )}

          <div className="flex-1 flex flex-col w-full min-h-0">
             <ChatHeader 
                isDesktop={logic.isDesktop}
                handleToggleSidebar={logic.handleToggleSidebar}
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
                    isAppLoading={logic.modelsLoading || logic.settingsLoading}
                    sendMessage={logic.sendMessage}
                    onCancel={logic.cancelGeneration}
                    ttsVoice={logic.ttsVoice}
                    ttsModel={logic.ttsModel}
                    setTtsVoice={logic.setTtsVoice}
                    currentChatId={logic.currentChatId}
                    activeModel={logic.activeModel} 
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
        </main>

        <SourcesSidebar
          isOpen={logic.isSourcesSidebarOpen}
          onClose={logic.handleCloseSourcesSidebar}
          sources={logic.sourcesForSidebar}
          width={logic.sourcesSidebarWidth}
          setWidth={logic.handleSetSourcesSidebarWidth}
          isResizing={logic.isSourcesResizing}
          setIsResizing={logic.setIsSourcesResizing}
        />

        <ArtifactSidebar
            isOpen={logic.isArtifactOpen}
            onClose={() => logic.setIsArtifactOpen(false)}
            content={logic.artifactContent}
            language={logic.artifactLanguage}
            width={logic.artifactWidth}
            setWidth={logic.setArtifactWidth}
            isResizing={logic.isArtifactResizing}
            setIsResizing={logic.setIsArtifactResizing}
        />

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
          onManageMemory={() => logic.setIsMemoryModalOpen(true)}
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
          // Provider Props for Ollama
          provider={logic.provider}
          openRouterApiKey={logic.openRouterApiKey}
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