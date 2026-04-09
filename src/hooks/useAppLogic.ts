
/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { useSidebar } from './useSidebar';
import { useTheme } from './useTheme';
import { useViewport } from './useViewport';
import { useChat } from './useChat/index';
import { useMemory } from './useMemory';
import { useSystemStatus } from './useSystemStatus';
import { useArtifacts } from './useArtifacts';
import { useChatActions } from './useChatActions';
import { getSettings, updateSettings, AppSettings } from '../services/settingsService';
import { apiClient } from '../services/apiClient';
import type { Model, Source } from '../types';
import { DEFAULT_TEMPERATURE, DEFAULT_MAX_TOKENS, DEFAULT_TTS_VOICE, DEFAULT_ABOUT_USER, DEFAULT_ABOUT_RESPONSE } from '../components/App/constants';
import { testSuite, type TestProgress } from '../components/Testing/testSuite';
import { MessageListHandle } from '../components/Chat/MessageList';
import { useSettingsStore } from '../store/settingsStore';
import { useUIStore } from '../store/uiStore';
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

    // --- Decomposed Hooks ---
    const { 
        backendStatus, backendError, versionMismatch, 
        modelsLoading, retryConnection, fetchModels 
    } = useSystemStatus();

    const {
        isArtifactOpen, setIsArtifactOpen, artifactContent, artifactLanguage,
        sourcesForSidebar, isSourcesSidebarOpen, handleShowSources, handleCloseSourcesSidebar
    } = useArtifacts();

    const [confirmation, setConfirmation] = useState<{
        prompt: string;
        onConfirm: () => void;
        onCancel?: () => void;
        destructive?: boolean;
    } | null>(null);

    // --- Memory Hook ---
    const memory = useMemory(settings.isMemoryEnabled);
    
    // --- Chat Hook ---
    const chatSettings = useMemo(() => ({
        systemPrompt: settings.systemPrompt,
        aboutUser: settings.aboutUser,
        aboutResponse: settings.aboutResponse,
        temperature: settings.temperature, 
        maxOutputTokens: settings.maxTokens,
        imageModel: settings.imageModel,
        videoModel: settings.videoModel
    }), [settings.systemPrompt, settings.aboutUser, settings.aboutResponse, settings.temperature, settings.maxTokens, settings.imageModel, settings.videoModel]);

    const activeApiKey = settings.provider === 'openrouter' ? settings.openRouterApiKey : (settings.provider === 'ollama' ? settings.ollamaApiKey : settings.apiKey);

    const handleToast = useCallback((msg: string, type: 'info' | 'success' | 'error') => {
        toast[type === 'info' ? 'info' : type === 'error' ? 'error' : 'success'](msg);
    }, []);

    const chat = useChat(
        settings.activeModel, 
        chatSettings,
        memory.memoryContent, 
        activeApiKey,
        handleToast,
        settings.provider
    );

    const { handleModelChange, onProviderChange, onSaveApiKey } = useChatActions(chat, fetchModels);

    // --- Settings Updaters ---
    const createSettingUpdater = <T,>(setter: (val: T) => void, key: keyof AppSettings) => async (val: T) => {
        setter(val);
        try {
            await apiClient.put('/api/settings', { [key]: val });
        } catch (error) {
            console.error(`Failed to update ${String(key)}:`, error);
        }
    };

    const handleSetAboutUser = createSettingUpdater(settings.setAboutUser, 'aboutUser');
    const handleSetAboutResponse = createSettingUpdater(settings.setAboutResponse, 'aboutResponse');
    const handleSetSystemPrompt = createSettingUpdater(settings.setSystemPrompt, 'systemPrompt');
    const handleSetTemperature = createSettingUpdater(settings.setTemperature, 'temperature');
    const handleSetMaxTokens = createSettingUpdater(settings.setMaxTokens, 'maxTokens');
    const handleSetTtsVoice = createSettingUpdater(settings.setTtsVoice, 'ttsVoice');
    
    const onImageModelChange = createSettingUpdater(settings.setImageModel, 'imageModel');
    const onVideoModelChange = createSettingUpdater(settings.setVideoModel, 'videoModel');
    const onTtsModelChange = createSettingUpdater(settings.setTtsModel, 'ttsModel');

    const handleSetIsMemoryEnabled = useCallback(async (enabled: boolean) => {
        settings.setIsMemoryEnabled(enabled);
        try {
            await apiClient.put('/api/settings', { isMemoryEnabled: enabled });
        } catch (e: any) { console.error("Failed to update memory enabled status:", e.message || e); }
    }, [settings]);

    const onSaveOllamaHost = useCallback(async (host: string) => {
        try {
            const response: any = await apiClient.put('/api/settings', { ollamaHost: host });
            settings.setOllamaHost(host);
            if (response.models) {
                settings.setAvailableModels(response.models);
            } else {
                await fetchModels();
            }
            toast.success('Ollama host updated.');
        } catch (error: any) {
            console.error("Failed to update Ollama host:", error.message || error);
        }
    }, [fetchModels, settings]);

    const onSaveServerUrl = useCallback(async (url: string) => {
        settings.setServerUrl(url);
        localStorage.setItem('custom_server_url', url);
        window.location.reload();
        return true;
    }, [settings]);

    const handleFileUploadForImport = useCallback((file: File) => {
        const reader = new FileReader();
        reader.onload = (e) => {
            try {
                const content = e.target?.result as string;
                const importedChat = JSON.parse(content);
                chat.importChat(importedChat);
                toast.success('Chat imported successfully.');
            } catch (err: any) {
                console.error("Import failed:", err.message || err);
                toast.error('Failed to import chat.');
            }
        };
        reader.readAsText(file);
    }, [chat.importChat]);

    const handleExportAllChats = useCallback(() => {
        import('../utils/exportUtils/index').then(mod => {
            mod.exportAllChatsToJson(chat.chatHistory);
        });
    }, [chat.chatHistory]);

    const handleDownloadLogs = useCallback(() => {
        import('../utils/logCollector').then(mod => {
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
        apiClient.get('/api/handler', { params: { task: 'debug_data_tree' } })
            .then(data => {
                console.log("Server Data Structure:", data);
                toast.success("Data structure logged to console.");
            })
            .catch(e => toast.error("Failed to fetch data structure"));
    }, []);

    const handleRequestClearAll = useCallback(() => {
        setConfirmation({
            prompt: "Are you sure you want to delete all chat history? This cannot be undone.",
            destructive: true,
            onConfirm: () => {
                if (chat.isLoading) {
                    chat.cancelGeneration();
                }
                chat.clearAllChats();
                setConfirmation(null);
                toast.info("All chats cleared.");
            },
            onCancel: () => setConfirmation(null)
        });
    }, [chat.clearAllChats, chat.isLoading, chat.cancelGeneration]);

    const handleDeleteChatRequest = useCallback((id: string) => {
        setConfirmation({
            prompt: "Delete this conversation?",
            destructive: true,
            onConfirm: () => {
                if (chat.currentChatId === id && chat.isLoading) {
                    chat.cancelGeneration();
                }
                chat.deleteChat(id);
                setConfirmation(null);
            },
            onCancel: () => setConfirmation(null)
        });
    }, [chat.deleteChat, chat.currentChatId, chat.isLoading, chat.cancelGeneration]);

    const handleConfirm = useCallback(() => {
        confirmation?.onConfirm();
    }, [confirmation]);

    const handleCancel = useCallback(() => {
        if (confirmation?.onCancel) confirmation.onCancel();
        setConfirmation(null);
    }, [confirmation]);

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

    const handleExportChat = useCallback((format: 'md' | 'json') => {
        if (!chat.currentChatId) return;
        const currentChat = chat.chatHistory.find(c => c.id === chat.currentChatId);
        if (!currentChat) return;

        import('../utils/exportUtils/index').then(mod => {
            if (format === 'json') mod.exportChatToJson(currentChat);
            else if (format === 'md') mod.exportChatToMarkdown(currentChat);
        });
    }, [chat.currentChatId, chat.chatHistory]);

    const handleShareChat = useCallback(() => {
        if (!chat.currentChatId) return;
        const currentChat = chat.chatHistory.find(c => c.id === chat.currentChatId);
        if (!currentChat) return;
        
        import('../utils/exportUtils/index').then(mod => {
            mod.exportChatToClipboard(currentChat);
        });
    }, [chat.currentChatId, chat.chatHistory]);

    const handleNewChat = useCallback(() => {
        chat.startNewChat(settings.activeModel, chatSettings);
    }, [chat.startNewChat, settings.activeModel, chatSettings]);

    return {
        isDesktop, isWideDesktop, visualViewportHeight,
        appContainerRef, messageListRef,
        theme, setTheme,
        
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
        isAnyResizing: false,
        isNewChatDisabled: modelsLoading || chat.isLoading,
        handleToggleSidebar: sidebar.toggleSidebar,
        handleShowSources,

        modelsLoading, 
        backendStatus, backendError, retryConnection,
        settingsLoading: false,
        
        availableModels: settings.availableModels,
        availableImageModels: settings.availableImageModels, 
        availableVideoModels: settings.availableVideoModels, 
        availableTtsModels: settings.availableTtsModels,
        
        provider: settings.provider, 
        openRouterApiKey: settings.openRouterApiKey, 
        ollamaHost: settings.ollamaHost,
        ollamaApiKey: settings.ollamaApiKey,
        onProviderChange, 
        onSaveApiKey, 
        onSaveOllamaHost,
        serverUrl: settings.serverUrl, 
        onSaveServerUrl,
        apiKey: settings.apiKey,
        
        activeModel: settings.activeModel, 
        onModelChange: handleModelChange,
        imageModel: settings.imageModel, 
        onImageModelChange,
        videoModel: settings.videoModel, 
        onVideoModelChange,
        ttsModel: settings.ttsModel, 
        onTtsModelChange,
        
        temperature: settings.temperature, 
        setTemperature: handleSetTemperature,
        maxTokens: settings.maxTokens, 
        setMaxTokens: handleSetMaxTokens,
        
        aboutUser: settings.aboutUser, 
        setAboutUser: handleSetAboutUser,
        aboutResponse: settings.aboutResponse, 
        setAboutResponse: handleSetAboutResponse,
        systemPrompt: settings.systemPrompt,
        setSystemPrompt: handleSetSystemPrompt,
        ttsVoice: settings.ttsVoice, 
        setTtsVoice: handleSetTtsVoice,
        
        memory,
        isMemoryEnabled: settings.isMemoryEnabled,
        setIsMemoryEnabled: handleSetIsMemoryEnabled,
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

        ...sidebar,
        
        ...chat,
        handleNewChat,
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
        
        isSourcesSidebarOpen, handleCloseSourcesSidebar, sourcesForSidebar, 
        
        isArtifactOpen, setIsArtifactOpen, artifactContent, artifactLanguage,

        runDiagnosticTests
    };
};
