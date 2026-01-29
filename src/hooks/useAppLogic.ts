


/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import { useSidebar } from './useSidebar';
import { useTheme } from './useTheme';
import { useViewport } from './useViewport';
import { useChat } from './useChat/index';
import { useMemory } from './useMemory';
import { getSettings, updateSettings, AppSettings } from '../services/settingsService';
import { fetchFromApi, setOnVersionMismatch } from '../utils/api';
import type { Model, Source } from '../types';
import { DEFAULT_TEMPERATURE, DEFAULT_MAX_TOKENS, DEFAULT_TTS_VOICE, DEFAULT_ABOUT_USER, DEFAULT_ABOUT_RESPONSE } from '../components/App/constants';
import { testSuite, type TestProgress } from '../components/Testing/testSuite';
import type { MessageFormHandle } from '../components/Chat/MessageForm/types';
import { MessageListHandle } from '../components/Chat/MessageList';

export const useAppLogic = () => {
    // --- UI State ---
    const { isDesktop, isWideDesktop, visualViewportHeight } = useViewport();
    const sidebar = useSidebar();
    const { theme, setTheme } = useTheme();
    const appContainerRef = useRef<HTMLDivElement>(null);
    const messageListRef = useRef<MessageListHandle>(null);

    const [isSettingsOpen, setIsSettingsOpen] = useState(false);
    const [isMemoryModalOpen, setIsMemoryModalOpen] = useState(false);
    const [isImportModalOpen, setIsImportModalOpen] = useState(false);
    const [isTestMode, setIsTestMode] = useState(false);
    const [toast, setToast] = useState<{ message: string; type: 'info' | 'success' | 'error' } | null>(null);
    const [confirmation, setConfirmation] = useState<{ prompt: string; onConfirm: () => void; onCancel?: () => void; destructive?: boolean } | null>(null);
    const [versionMismatch, setVersionMismatch] = useState(false);

    // --- Data State ---
    const [settingsLoading, setSettingsLoading] = useState(true);
    const [modelsLoading, setModelsLoading] = useState(false);
    const [availableModels, setAvailableModels] = useState<Model[]>([]);
    const [availableImageModels, setAvailableImageModels] = useState<Model[]>([]);
    const [availableVideoModels, setAvailableVideoModels] = useState<Model[]>([]);
    const [availableTtsModels, setAvailableTtsModels] = useState<Model[]>([]);
    
    // --- Settings State ---
    const [provider, setProvider] = useState<'gemini' | 'openrouter' | 'ollama'>('gemini');
    const [apiKey, setApiKey] = useState('');
    const [openRouterApiKey, setOpenRouterApiKey] = useState('');
    const [ollamaApiKey, setOllamaApiKey] = useState('');
    const [ollamaHost, setOllamaHost] = useState('');
    const [serverUrl, setServerUrl] = useState('');
    const [activeModel, setActiveModel] = useState('');
    const [imageModel, setImageModel] = useState('');
    const [videoModel, setVideoModel] = useState('');
    const [ttsModel, setTtsModel] = useState('');
    const [temperature, setTemperature] = useState(DEFAULT_TEMPERATURE);
    const [maxTokens, setMaxTokens] = useState(DEFAULT_MAX_TOKENS);
    const [aboutUser, setAboutUser] = useState(DEFAULT_ABOUT_USER);
    const [aboutResponse, setAboutResponse] = useState(DEFAULT_ABOUT_RESPONSE);
    const [ttsVoice, setTtsVoice] = useState(DEFAULT_TTS_VOICE);
    const [isMemoryEnabled, setIsMemoryEnabledState] = useState(false);

    // --- Sidebars State ---
    const [isSourcesSidebarOpen, setIsSourcesSidebarOpen] = useState(false);
    const [sourcesForSidebar, setSourcesForSidebar] = useState<Source[]>([]);
    const [isArtifactOpen, setIsArtifactOpen] = useState(false);
    const [artifactContent, setArtifactContent] = useState('');
    const [artifactLanguage, setArtifactLanguage] = useState('');
    const [artifactWidth, setArtifactWidth] = useState(500);
    const [isArtifactResizing, setIsArtifactResizing] = useState(false);

    // --- Backend Status ---
    const [backendStatus, setBackendStatus] = useState<'online' | 'offline' | 'checking'>('checking');
    const [backendError, setBackendError] = useState<string | null>(null);

    // --- Notifications ---
    const showToast = useCallback((message: string, type: 'info' | 'success' | 'error' = 'info') => {
        setToast({ message, type });
    }, []);

    const closeToast = useCallback(() => {
        setToast(null);
    }, []);

    // --- Version Mismatch Handling ---
    useEffect(() => {
        setOnVersionMismatch(() => setVersionMismatch(true));
        
        // Listen for open-settings event
        const handleOpenSettings = () => setIsSettingsOpen(true);
        window.addEventListener('open-settings', handleOpenSettings);
        return () => window.removeEventListener('open-settings', handleOpenSettings);
    }, []);

    // --- Memory Hook ---
    const memory = useMemory(isMemoryEnabled);

    // --- Chat Hook ---
    // Select appropriate key for chat logic
    const activeKey = provider === 'openrouter' ? openRouterApiKey : (provider === 'ollama' ? ollamaApiKey : apiKey);
    
    const chat = useChat(
        activeModel, 
        { 
            systemPrompt: "", // Built dynamically in backend based on aboutUser/Response
            aboutUser,
            aboutResponse,
            temperature, 
            maxOutputTokens: maxTokens,
            imageModel,
            videoModel
        }, 
        memory.memoryContent, 
        activeKey,
        showToast
    );

    // --- Helper to process models from backend response ---
    const processModelData = useCallback((data: any) => {
        if (data.models) setAvailableModels(data.models);
        if (data.imageModels) setAvailableImageModels(data.imageModels);
        if (data.videoModels) setAvailableVideoModels(data.videoModels);
        if (data.ttsModels) setAvailableTtsModels(data.ttsModels);
    }, []);

    // --- Initial Data Loading ---
    const fetchModels = useCallback(async () => {
        setModelsLoading(true);
        try {
            const res = await fetchFromApi('/api/models');
            if (res.ok) {
                const data = await res.json();
                processModelData(data);
                setBackendStatus('online');
                setBackendError(null);
            } else {
                 const text = await res.text();
                 throw new Error(`Status: ${res.status} - ${text}`);
            }
        } catch (e) {
            console.error("Failed to fetch models:", e);
            setBackendStatus('offline');
            setBackendError(e instanceof Error ? e.message : "Could not connect to backend server.");
            // Keep models empty on failure so UI knows
        } finally {
            setModelsLoading(false);
        }
    }, [processModelData]);

    useEffect(() => {
        const init = async () => {
            try {
                const settings = await getSettings();
                setProvider(settings.provider || 'gemini');
                setApiKey(settings.apiKey || '');
                setOpenRouterApiKey(settings.openRouterApiKey || '');
                setOllamaApiKey(settings.ollamaApiKey || '');
                setOllamaHost(settings.ollamaHost || '');
                setActiveModel(settings.activeModel || '');
                setImageModel(settings.imageModel || '');
                setVideoModel(settings.videoModel || '');
                setTtsModel(settings.ttsModel || '');
                setTemperature(settings.temperature ?? DEFAULT_TEMPERATURE);
                setMaxTokens(settings.maxTokens ?? DEFAULT_MAX_TOKENS);
                setAboutUser(settings.aboutUser ?? DEFAULT_ABOUT_USER);
                setAboutResponse(settings.aboutResponse ?? DEFAULT_ABOUT_RESPONSE);
                setTtsVoice(settings.ttsVoice ?? DEFAULT_TTS_VOICE);
                setIsMemoryEnabledState(settings.isMemoryEnabled ?? false);
                
                // Fetch models if we have a key or provider is ollama
                if ((settings.provider === 'gemini' && settings.apiKey) || 
                    (settings.provider === 'openrouter' && settings.openRouterApiKey) ||
                    (settings.provider === 'ollama')) {
                    await fetchModels();
                } else {
                    // No key configured yet, but backend is technically reachable (since getSettings succeeded)
                    setBackendStatus('online');
                }
            } catch (e) {
                console.error("Failed to load settings:", e);
                setBackendStatus('offline');
                setBackendError("Could not connect to backend server.");
            } finally {
                setSettingsLoading(false);
            }
        };
        init();
    }, []);

    // --- Settings Updaters ---
    
    // Generic updater generator
    const createSettingUpdater = <T,>(setter: (val: T) => void, key: keyof AppSettings) => async (val: T) => {
        setter(val);
        try {
            await updateSettings({ [key]: val });
        } catch (error) {
            console.error(`Failed to update ${String(key)}:`, error);
            showToast(`Failed to save ${String(key)} setting.`, 'error');
        }
    };

    const handleSetAboutUser = createSettingUpdater(setAboutUser, 'aboutUser');
    const handleSetAboutResponse = createSettingUpdater(setAboutResponse, 'aboutResponse');
    const handleSetTemperature = createSettingUpdater(setTemperature, 'temperature');
    const handleSetMaxTokens = createSettingUpdater(setMaxTokens, 'maxTokens');
    const handleSetTtsVoice = createSettingUpdater(setTtsVoice, 'ttsVoice');
    
    // Specialized Updaters
    const onModelChange = useCallback(async (modelId: string) => {
        setActiveModel(modelId);
        try {
            await updateSettings({ activeModel: modelId });
            chat.updateChatModel(chat.currentChatId || '', modelId);
        } catch (e) { console.error(e); }
    }, [chat.updateChatModel, chat.currentChatId]);

    const onImageModelChange = createSettingUpdater(setImageModel, 'imageModel');
    const onVideoModelChange = createSettingUpdater(setVideoModel, 'videoModel');
    const onTtsModelChange = createSettingUpdater(setTtsModel, 'ttsModel');

    const handleSetIsMemoryEnabled = useCallback(async (enabled: boolean) => {
        setIsMemoryEnabledState(enabled);
        try {
            await updateSettings({ isMemoryEnabled: enabled });
        } catch (e) { console.error(e); }
    }, []);

    const onProviderChange = useCallback(async (newProvider: 'gemini' | 'openrouter' | 'ollama') => {
        setProvider(newProvider);
        try {
            const response = await updateSettings({ provider: newProvider });
            
            // If the backend returned new models for this provider, update them
            if (response.models) {
                processModelData(response);
            } else {
                // Otherwise fetch explicitly
                await fetchModels();
            }
            
            showToast(`Switched provider to ${newProvider === 'gemini' ? 'Google Gemini' : newProvider === 'openrouter' ? 'OpenRouter' : 'Ollama'}.`, 'success');
        } catch (error) {
            console.error("Failed to update provider:", error);
            showToast("Failed to switch provider.", 'error');
        }
    }, [processModelData, fetchModels, showToast]);

    const onSaveApiKey = useCallback(async (key: string, providerType: 'gemini' | 'openrouter' | 'ollama') => {
        if (providerType === 'gemini') setApiKey(key);
        if (providerType === 'openrouter') setOpenRouterApiKey(key);
        if (providerType === 'ollama') setOllamaApiKey(key);
        
        try {
            const updatePayload: Partial<AppSettings> = {};
            if (providerType === 'gemini') updatePayload.apiKey = key;
            if (providerType === 'openrouter') updatePayload.openRouterApiKey = key;
            if (providerType === 'ollama') updatePayload.ollamaApiKey = key; 

            const response = await updateSettings(updatePayload);
            
            // Refresh models with the new key
            if (response.models) {
                processModelData(response);
            } else {
                await fetchModels();
            }
            
            showToast('API Key saved successfully.', 'success');
        } catch (error) {
            console.error("Failed to save API key:", error);
            showToast('Failed to save API Key.', 'error');
        }
    }, [processModelData, fetchModels, showToast]);

    const onSaveOllamaHost = useCallback(async (host: string) => {
        setOllamaHost(host);
        try {
            const response = await updateSettings({ ollamaHost: host });
            if (response.models) {
                processModelData(response);
            } else {
                await fetchModels();
            }
            showToast('Ollama host updated.', 'success');
        } catch (error) {
            console.error("Failed to update Ollama host:", error);
            showToast('Failed to update Ollama host.', 'error');
        }
    }, [processModelData, fetchModels, showToast]);

    const onSaveServerUrl = useCallback(async (url: string) => {
        setServerUrl(url);
        localStorage.setItem('custom_server_url', url);
        // Force reload to apply new base URL for all api calls
        window.location.reload();
        return true;
    }, []);

    // --- Modal & Sidebar Handlers ---
    const handleShowSources = useCallback((sources: Source[]) => {
        setSourcesForSidebar(sources);
        setIsSourcesSidebarOpen(true);
    }, []);

    const handleCloseSourcesSidebar = useCallback(() => setIsSourcesSidebarOpen(false), []);

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

    const handleFileUploadForImport = useCallback((file: File) => {
        const reader = new FileReader();
        reader.onload = (e) => {
            try {
                const content = e.target?.result as string;
                const importedChat = JSON.parse(content);
                chat.importChat(importedChat);
                showToast('Chat imported successfully.', 'success');
            } catch (err) {
                console.error("Import failed:", err);
                showToast('Failed to import chat. Invalid file format.', 'error');
            }
        };
        reader.readAsText(file);
    }, [chat.importChat, showToast]);

    const handleExportAllChats = useCallback(() => {
        import('../utils/exportUtils').then(mod => {
            (mod as any).exportAllChatsToJson(chat.chatHistory);
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
        fetchFromApi('/api/handler?task=debug_data_tree')
            .then(res => res.json())
            .then(data => {
                console.log("Server Data Structure:", data);
                alert("Data structure logged to console.");
            })
            .catch(e => showToast("Failed to fetch data structure", "error"));
    }, [showToast]);

    // --- Confirmation Dialog ---
    const handleRequestClearAll = useCallback(() => {
        setConfirmation({
            prompt: "Are you sure you want to delete all chat history? This cannot be undone.",
            destructive: true,
            onConfirm: () => {
                chat.clearAllChats();
                setConfirmation(null);
                showToast("All chats cleared.", "info");
            },
            onCancel: () => setConfirmation(null)
        });
    }, [chat.clearAllChats, showToast]);

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

    const handleConfirm = useCallback(() => {
        confirmation?.onConfirm();
    }, [confirmation]);

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

    // --- Connection Retry ---
    const retryConnection = useCallback(() => {
        setBackendStatus('checking');
        setBackendError(null);
        fetchModels().then(() => {
            // fetchModels sets success status on success
        }).catch(() => {
            // fetchModels sets failure status on failure
        });
    }, [fetchModels]);

    // --- Export ---
    const handleExportChat = useCallback((format: 'md' | 'json' | 'pdf') => {
        if (!chat.currentChatId) return;
        const currentChat = chat.chatHistory.find(c => c.id === chat.currentChatId);
        if (!currentChat) return;

        import('../utils/exportUtils').then(mod => {
            if (format === 'json') (mod as any).exportChatToJson(currentChat);
            else if (format === 'md') (mod as any).exportChatToMarkdown(currentChat);
            else if (format === 'pdf') (mod as any).exportChatToPdf(currentChat);
        });
    }, [chat.currentChatId, chat.chatHistory]);

    const handleShareChat = useCallback(() => {
        if (!chat.currentChatId) return;
        const currentChat = chat.chatHistory.find(c => c.id === chat.currentChatId);
        if (!currentChat) return;
        
        import('../utils/exportUtils').then(mod => {
            (mod as any).exportChatToClipboard(currentChat);
        });
    }, [chat.currentChatId, chat.chatHistory]);

    return {
        // App State
        isDesktop, isWideDesktop, visualViewportHeight,
        appContainerRef, messageListRef,
        theme, setTheme,
        
        // Modals & UI
        isSettingsOpen, setIsSettingsOpen,
        isMemoryModalOpen, setIsMemoryModalOpen,
        isImportModalOpen, setIsImportModalOpen,
        isTestMode, setIsTestMode,
        toast, showToast, closeToast,
        confirmation, handleConfirm, handleCancel,
        versionMismatch,
        isAnyResizing: sidebar.isResizing || sidebar.isSourcesResizing || isArtifactResizing,
        isNewChatDisabled: modelsLoading || settingsLoading || chat.isLoading,
        handleToggleSidebar: () => sidebar.setIsSidebarOpen(!sidebar.isSidebarOpen),
        handleShowSources,

        // Data & Backend
        settingsLoading, modelsLoading, backendStatus, backendError, retryConnection,
        availableModels, availableImageModels, availableVideoModels, availableTtsModels,
        
        // Settings
        provider, openRouterApiKey, ollamaHost, ollamaApiKey,
        onProviderChange, onSaveApiKey, onSaveOllamaHost,
        serverUrl, onSaveServerUrl,
        apiKey,
        
        activeModel, onModelChange,
        imageModel, onImageModelChange,
        videoModel, onVideoModelChange,
        ttsModel, onTtsModelChange,
        
        temperature, setTemperature: handleSetTemperature,
        maxTokens, setMaxTokens: handleSetMaxTokens,
        
        aboutUser, setAboutUser: handleSetAboutUser,
        aboutResponse, setAboutResponse: handleSetAboutResponse,
        ttsVoice, setTtsVoice: handleSetTtsVoice,
        
        // Memory
        memory,
        isMemoryEnabled,
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

        // Sidebar Hooks
        ...sidebar,
        
        // Chat Hooks
        ...chat,
        setActiveResponseIndex: chat.setResponseIndex,
        handleRequestClearAll, handleDeleteChatRequest,
        handleImportChat: () => setIsImportModalOpen(true),
        handleFileUploadForImport,
        handleExportAllChats,
        handleDownloadLogs,
        handleShowDataStructure,
        handleExportChat,
        handleShareChat,
        isChatActive: !!chat.currentChatId,
        
        // Secondary Sidebars
        isSourcesSidebarOpen, handleCloseSourcesSidebar, sourcesForSidebar, 
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