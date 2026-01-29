/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useSidebar } from '../../hooks/useSidebar';
import { useTheme } from '../../hooks/useTheme';
import { useViewport } from '../../hooks/useViewport';
import { useChat } from '../../hooks/useChat/index';
import { useMemory } from '../../hooks/useMemory';
import { getSettings } from '../../services/settingsService';
import { fetchFromApi, setOnVersionMismatch } from '../../utils/api';
import { testSuite, type TestProgress } from '../Testing/testSuite';
import type { MessageFormHandle } from '../Chat/MessageForm/types';
import { MessageListHandle } from '../Chat/MessageList';
import type { ChatSession } from '../../types';
import { useSettingsStore } from '../../store/settingsStore';
import { useUIStore } from '../../store/uiStore';
import { toast } from 'sonner';

export const useAppLogic = () => {
    // --- Store State ---
    const settings = useSettingsStore();
    const ui = useUIStore();
    
    // --- UI State ---
    const { isDesktop, isWideDesktop, visualViewportHeight } = useViewport();
    const sidebar = useSidebar();
    const { theme, setTheme } = useTheme();
    const appContainerRef = useRef<HTMLDivElement>(null);
    const messageListRef = useRef<MessageListHandle>(null);
    const [versionMismatch, setVersionMismatch] = useState(false);

    // --- Backend Status ---
    const [backendStatus, setBackendStatus] = useState<'online' | 'offline' | 'checking'>('checking');
    const [backendError, setBackendError] = useState<string | null>(null);

    // --- Version Mismatch Handling ---
    useEffect(() => {
        setOnVersionMismatch(() => setVersionMismatch(true));
        const handleOpenSettings = () => ui.setSettingsOpen(true);
        window.addEventListener('open-settings', handleOpenSettings);
        return () => window.removeEventListener('open-settings', handleOpenSettings);
    }, [ui]);

    // --- Memory Hook ---
    const memory = useMemory(settings.isMemoryEnabled);

    // --- Chat Hook ---
    const chat = useChat(
        settings.activeModel, 
        { 
            systemPrompt: "",
            aboutUser: settings.aboutUser,
            aboutResponse: settings.aboutResponse,
            temperature: settings.temperature, 
            maxOutputTokens: settings.maxTokens,
            imageModel: settings.imageModel,
            videoModel: settings.videoModel
        }, 
        memory.memoryContent, 
        settings.provider === 'openrouter' ? settings.openRouterApiKey : settings.apiKey,
        (msg, type) => toast[type === 'info' ? 'info' : type === 'error' ? 'error' : 'success'](msg)
    );

    // --- Initial Data Loading ---
    const fetchModels = useCallback(async () => {
        try {
            const res = await fetchFromApi('/api/models');
            if (res.ok) {
                const data = await res.json();
                settings.setAvailableModels(data.models || []);
                settings.setAvailableImageModels(data.imageModels || []);
                settings.setAvailableVideoModels(data.videoModels || []);
                settings.setAvailableTtsModels(data.ttsModels || []);
                setBackendStatus('online');
                setBackendError(null);
            } else {
                 throw new Error(`Status: ${res.status}`);
            }
        } catch (e) {
            console.error("Failed to fetch models:", e);
            setBackendStatus('offline');
            setBackendError(e instanceof Error ? e.message : "Could not connect to backend server.");
        }
    }, [settings]);

    useEffect(() => {
        const init = async () => {
            try {
                const serverSettings = await getSettings();
                // Hydrate store from server if needed, though persist middleware handles local
                // We mainly want to verify connection here
                if (serverSettings) {
                    // Update connection-critical keys if server has them (rare in local-first, but good for sync)
                    // Logic: prefer local changes if newer? For now simpler to just ensure we are connected
                    
                    if ((settings.provider === 'gemini' && settings.apiKey) || 
                        (settings.provider === 'openrouter' && settings.openRouterApiKey) ||
                        (settings.provider === 'ollama')) {
                        await fetchModels();
                    } else {
                        setBackendStatus('online');
                    }
                }
            } catch (e) {
                console.error("Failed to load settings:", e);
                setBackendStatus('offline');
                setBackendError("Could not connect to backend server.");
            }
        };
        init();
    }, []);

    // --- Model Change Wrappers ---
    const handleModelChange = (modelId: string) => {
        settings.setActiveModel(modelId);
        chat.updateChatModel(chat.currentChatId || '', modelId);
    };

    // --- Sidebar Handlers ---
    const [isSourcesSidebarOpen, setIsSourcesSidebarOpen] = useState(false);
    const [sourcesForSidebar, setSourcesForSidebar] = useState<any[]>([]);
    
    // Artifact Sidebar State (Local state fine for ephemeral UI)
    const [isArtifactOpen, setIsArtifactOpen] = useState(false);
    const [artifactContent, setArtifactContent] = useState('');
    const [artifactLanguage, setArtifactLanguage] = useState('');
    const [artifactWidth, setArtifactWidth] = useState(500);
    const [isArtifactResizing, setIsArtifactResizing] = useState(false);
    
    // Open artifact handler
    useEffect(() => {
        const handleOpenArtifact = (e: CustomEvent) => {
            const { code, language } = e.detail;
            setArtifactContent(code);
            setArtifactLanguage(language);
            setIsArtifactOpen(true);
        };
        window.addEventListener('open-artifact', handleOpenArtifact as EventListener);
        return () => window.removeEventListener('open-artifact', handleOpenArtifact as EventListener);
    }, []);

    const handleShowSources = useCallback((sources: any[]) => {
        setSourcesForSidebar(sources);
        setIsSourcesSidebarOpen(true);
    }, []);

    // --- Exports & Logs ---
    const handleFileUploadForImport = useCallback((file: File) => {
        const reader = new FileReader();
        reader.onload = (e) => {
            try {
                const content = e.target?.result as string;
                const importedChat = JSON.parse(content);
                chat.importChat(importedChat);
                toast.success('Chat imported successfully.');
            } catch (err) {
                toast.error('Failed to import chat. Invalid file format.');
            }
        };
        reader.readAsText(file);
    }, [chat.importChat]);

    const handleExportAllChats = useCallback(() => {
        import('../../utils/exportUtils').then(mod => {
            (mod as any).exportAllChatsToJson(chat.chatHistory);
        });
    }, [chat.chatHistory]);

    const handleDownloadLogs = useCallback(() => {
        import('../../utils/logCollector').then(mod => {
            const logs = mod.logCollector.formatLogs();
            const blob = new Blob([logs], { type: 'text/plain' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `agentic-ai-logs-${new Date().toISOString()}.txt`;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);
        });
    }, []);
    
    const handleShowDataStructure = useCallback(() => {
        fetchFromApi('/api/handler?task=debug_data_tree')
            .then(res => res.json())
            .then(data => {
                console.log("Server Data Structure:", data);
                toast.success("Data structure logged to console.");
            })
            .catch(e => toast.error("Failed to fetch data structure"));
    }, []);

    // --- Confirmation Dialog ---
    const [confirmation, setConfirmation] = useState<{ prompt: string; onConfirm: () => void; onCancel?: () => void; destructive?: boolean } | null>(null);

    const handleRequestClearAll = useCallback(() => {
        setConfirmation({
            prompt: "Are you sure you want to delete all chat history? This cannot be undone.",
            destructive: true,
            onConfirm: () => {
                chat.clearAllChats();
                setConfirmation(null);
                toast.info("All chats cleared.");
            },
            onCancel: () => setConfirmation(null)
        });
    }, [chat.clearAllChats]);

    const handleDeleteChatRequest = useCallback((id: string) => {
        setConfirmation({
            prompt: "Delete this conversation?",
            destructive: true,
            onConfirm: () => {
                chat.deleteChat(id);
                setConfirmation(null);
            },
            onCancel: () => setConfirmation(null)
        });
    }, [chat.deleteChat]);

    const handleConfirm = useCallback(() => confirmation?.onConfirm(), [confirmation]);
    const handleCancel = useCallback(() => {
        if (confirmation?.onCancel) confirmation.onCancel();
        setConfirmation(null);
    }, [confirmation]);

    // --- Test Runner ---
    const runDiagnosticTests = useCallback(async (onProgress: (p: TestProgress) => void) => {
        let logs = "Running Diagnostic Tests...\n\n";
        let passed = 0;
        let failed = 0;
        const total = testSuite.length;

        for (let i = 0; i < total; i++) {
            const test = testSuite[i];
            onProgress({
                total,
                current: i + 1,
                description: test.description,
                status: 'running',
                results: []
            });

            try {
                const msg = await chat.sendMessageForTest(test.prompt, test.options);
                const result = await test.validate(msg);
                
                if (result.pass) passed++; else failed++;
                logs += `[${result.pass ? 'PASS' : 'FAIL'}] ${test.description}\nDetails: ${result.details}\n\n`;
            } catch (e: any) {
                failed++;
                logs += `[ERROR] ${test.description}\nException: ${e.message}\n\n`;
            }
        }

        logs += `\nSUMMARY: ${passed} Passed, ${failed} Failed.`;
        return logs;
    }, [chat.sendMessageForTest]);

    // --- Export ---
    const handleExportChat = useCallback((format: 'md' | 'json' | 'pdf') => {
        if (!chat.currentChatId) return;
        const currentChat = chat.chatHistory.find(c => c.id === chat.currentChatId);
        if (!currentChat) return;

        import('../../utils/exportUtils').then(mod => {
            if (format === 'json') (mod as any).exportChatToJson(currentChat);
            else if (format === 'md') (mod as any).exportChatToMarkdown(currentChat);
            else if (format === 'pdf') (mod as any).exportChatToPdf(currentChat);
        });
    }, [chat.currentChatId, chat.chatHistory]);

    const handleShareChat = useCallback(() => {
        if (!chat.currentChatId) return;
        const currentChat = chat.chatHistory.find(c => c.id === chat.currentChatId);
        if (!currentChat) return;
        
        import('../../utils/exportUtils').then(mod => {
            (mod as any).exportChatToClipboard(currentChat);
        });
    }, [chat.currentChatId, chat.chatHistory]);

    // Helper for saving API key and refreshing models
    const saveApiKey = async (key: string, providerType: 'gemini' | 'openrouter' | 'ollama') => {
        if (providerType === 'gemini') settings.setApiKey(key);
        if (providerType === 'openrouter') settings.setOpenRouterApiKey(key);
        
        // Persist to backend/settings
        // We use the store's action which updates local state, but we also want to persist.
        // We assume settingsStore.persist middleware handles local storage, 
        // and we call backend update here for server-side persistence if needed
        // but typically client-side keys are enough if backend acts as relay.
        // If backend needs key for tools, we should push it.
        
        // Trigger model refresh
        await fetchModels();
        toast.success("API Key saved.");
    };

    return {
        isDesktop, isWideDesktop, visualViewportHeight,
        appContainerRef, messageListRef,
        theme, setTheme,
        
        // Modals & UI (from Store)
        isSettingsOpen: ui.isSettingsOpen, 
        setIsSettingsOpen: ui.setSettingsOpen,
        isMemoryModalOpen: ui.isMemoryModalOpen, 
        setIsMemoryModalOpen: ui.setMemoryModalOpen,
        isImportModalOpen: ui.isImportModalOpen, 
        setIsImportModalOpen: ui.setImportModalOpen,
        isTestMode: ui.isTestMode, 
        setIsTestMode: ui.setTestMode,
        
        showToast: (msg: string, type: any) => toast[type === 'error' ? 'error' : 'success'](msg),
        closeToast: () => {},

        confirmation, handleConfirm, handleCancel,
        versionMismatch,
        isAnyResizing: sidebar.isResizing || sidebar.isSourcesResizing || isArtifactResizing,
        isNewChatDisabled: chat.isLoading,
        handleToggleSidebar: ui.toggleSidebar,
        handleShowSources,

        settingsLoading: false, 
        modelsLoading: false, 
        backendStatus, backendError, retryConnection: fetchModels,
        
        // Data from Store
        availableModels: settings.availableModels,
        availableImageModels: settings.availableImageModels, 
        availableVideoModels: settings.availableVideoModels, 
        availableTtsModels: settings.availableTtsModels,
        
        // Settings from Store
        provider: settings.provider, 
        openRouterApiKey: settings.openRouterApiKey, 
        ollamaHost: settings.ollamaHost,
        onProviderChange: settings.setProvider, 
        onSaveApiKey: saveApiKey, 
        onSaveOllamaHost: settings.setOllamaHost,
        serverUrl: settings.serverUrl, 
        onSaveServerUrl: async (url: string) => { settings.setServerUrl(url); return true; },
        apiKey: settings.apiKey,
        
        activeModel: settings.activeModel, 
        onModelChange: handleModelChange,
        imageModel: settings.imageModel, 
        onImageModelChange: settings.setImageModel,
        videoModel: settings.videoModel, 
        onVideoModelChange: settings.setVideoModel,
        ttsModel: settings.ttsModel, 
        onTtsModelChange: settings.setTtsModel,
        
        temperature: settings.temperature, 
        setTemperature: settings.setTemperature,
        maxTokens: settings.maxTokens, 
        setMaxTokens: settings.setMaxTokens,
        
        aboutUser: settings.aboutUser, 
        setAboutUser: settings.setAboutUser,
        aboutResponse: settings.aboutResponse, 
        setAboutResponse: settings.setAboutResponse,
        ttsVoice: settings.ttsVoice, 
        setTtsVoice: settings.setTtsVoice,
        
        // Memory
        memory,
        isMemoryEnabled: settings.isMemoryEnabled,
        setIsMemoryEnabled: settings.setIsMemoryEnabled,
        memoryContent: memory.memoryContent,
        memoryFiles: memory.memoryFiles,
        clearMemory: memory.clearMemory,
        updateBackendMemory: memory.updateBackendMemory,
        updateMemoryFiles: memory.updateMemoryFiles,
        isConfirmationOpen: memory.isConfirmationOpen,
        memorySuggestions: memory.memorySuggestions,
        confirmMemoryUpdate: memory.confirmMemoryUpdate,
        cancelMemoryUpdate: memory.cancelMemoryUpdate,
        onManageMemory: () => ui.setMemoryModalOpen(true),

        // Sidebar Hooks
        ...sidebar,
        
        // Chat Hooks
        ...chat,
        setActiveResponseIndex: chat.setResponseIndex,
        handleRequestClearAll, handleDeleteChatRequest,
        handleImportChat: () => ui.setImportModalOpen(true),
        handleFileUploadForImport,
        handleExportAllChats,
        handleDownloadLogs,
        handleShowDataStructure,
        handleExportChat,
        handleShareChat,
        isChatActive: !!chat.currentChatId,
        
        // Secondary Sidebars
        isSourcesSidebarOpen, 
        handleCloseSourcesSidebar: () => setIsSourcesSidebarOpen(false), 
        sourcesForSidebar, 
        sourcesSidebarWidth: sidebar.sourcesSidebarWidth, 
        handleSetSourcesSidebarWidth: sidebar.handleSetSourcesSidebarWidth,
        isSourcesResizing: sidebar.isSourcesResizing,
        setIsSourcesResizing: sidebar.setIsSourcesResizing,

        isArtifactOpen, setIsArtifactOpen, artifactContent, artifactLanguage,
        artifactWidth, setArtifactWidth, isArtifactResizing, setIsArtifactResizing,

        // Tests
        runDiagnosticTests
    };
};