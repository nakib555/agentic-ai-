
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
    const [versionMismatch, setVersionMismatch] = useState(false);

    // --- Local UI State ---
    const [sourcesForSidebar, setSourcesForSidebar] = useState<Source[]>([]);
    const [isSourcesSidebarOpen, setIsSourcesSidebarOpen] = useState(false);

    const [isArtifactOpen, setIsArtifactOpen] = useState(false);
    const [artifactContent, setArtifactContent] = useState('');
    const [artifactLanguage, setArtifactLanguage] = useState('text');

    const [confirmation, setConfirmation] = useState<{
        prompt: string;
        onConfirm: () => void;
        onCancel?: () => void;
        destructive?: boolean;
    } | null>(null);

    const [modelsLoading, setModelsLoading] = useState(false);
    const settingsLoading = false; 

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
        settings.provider === 'openrouter' ? settings.openRouterApiKey : (settings.provider === 'ollama' ? settings.ollamaApiKey : settings.apiKey),
        (msg, type) => toast[type === 'info' ? 'info' : type === 'error' ? 'error' : 'success'](msg)
    );

    // --- Helper to process models from backend response ---
    const processModelData = useCallback((data: any) => {
        if (data.models) {
            settings.setAvailableModels(data.models);
            
            // NOTE: Auto-switching logic has been removed from here to prevent infinite loops 
            // when model lists are unstable or fluctuate (e.g. OpenRouter).
            // We now rely on explicit provider changes or user selection to change the active model.
        }
        if (data.imageModels) settings.setAvailableImageModels(data.imageModels);
        if (data.videoModels) settings.setAvailableVideoModels(data.videoModels);
        if (data.ttsModels) settings.setAvailableTtsModels(data.ttsModels);
    }, [settings]);

    // --- Initial Data Loading ---
    const fetchModels = useCallback(async () => {
        setModelsLoading(true);
        try {
            // Append timestamp to prevent browser caching of the models list
            const res = await fetchFromApi(`/api/models?_t=${Date.now()}`);
            if (res.ok) {
                const data = await res.json();
                processModelData(data);
                setBackendStatus('online');
                setBackendError(null);
            } else {
                 throw new Error(`Status: ${res.status}`);
            }
        } catch (e) {
            console.error("Failed to fetch models:", e);
            setBackendStatus('offline');
            setBackendError(e instanceof Error ? e.message : "Could not connect to backend server.");
        } finally {
            setModelsLoading(false);
        }
    }, [processModelData]);

    useEffect(() => {
        const init = async () => {
            try {
                const serverSettings = await getSettings();
                if (serverSettings) {
                    // Update connection-critical keys if server has them
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

    // --- Settings Updaters ---
    
    // Generic updater generator
    const createSettingUpdater = <T,>(setter: (val: T) => void, key: keyof AppSettings) => async (val: T) => {
        setter(val);
        try {
            await updateSettings({ [key]: val });
        } catch (error) {
            console.error(`Failed to update ${String(key)}:`, error);
            toast.error(`Failed to save ${String(key)} setting.`);
        }
    };

    const handleSetAboutUser = createSettingUpdater(settings.setAboutUser, 'aboutUser');
    const handleSetAboutResponse = createSettingUpdater(settings.setAboutResponse, 'aboutResponse');
    const handleSetTemperature = createSettingUpdater(settings.setTemperature, 'temperature');
    const handleSetMaxTokens = createSettingUpdater(settings.setMaxTokens, 'maxTokens');
    const handleSetTtsVoice = createSettingUpdater(settings.setTtsVoice, 'ttsVoice');
    
    const handleModelChange = useCallback(async (modelId: string) => {
        settings.setActiveModel(modelId);
        try {
            await updateSettings({ activeModel: modelId });
            // Only update chat model if there is an active chat
            if (chat.currentChatId) {
                chat.updateChatModel(chat.currentChatId, modelId);
            }
        } catch (e) { console.error(e); }
    }, [chat.updateChatModel, chat.currentChatId, settings]);

    const onImageModelChange = createSettingUpdater(settings.setImageModel, 'imageModel');
    const onVideoModelChange = createSettingUpdater(settings.setVideoModel, 'videoModel');
    const onTtsModelChange = createSettingUpdater(settings.setTtsModel, 'ttsModel');

    const handleSetIsMemoryEnabled = useCallback(async (enabled: boolean) => {
        settings.setIsMemoryEnabled(enabled);
        try {
            await updateSettings({ isMemoryEnabled: enabled });
        } catch (e) { console.error(e); }
    }, [settings]);

    const onProviderChange = useCallback(async (newProvider: 'gemini' | 'openrouter' | 'ollama') => {
        settings.setProvider(newProvider);
        setModelsLoading(true);
        // Clear models to force visual refresh
        settings.setAvailableModels([]);
        settings.setAvailableImageModels([]);
        settings.setAvailableVideoModels([]);
        settings.setAvailableTtsModels([]);

        try {
            const response = await updateSettings({ provider: newProvider });
            
            let modelsList = response.models || [];

            // If the backend returned new models for this provider, update them
            if (response.models) {
                processModelData(response);
            } else {
                // Otherwise fetch explicitly
                await fetchModels();
                // Note: fetchModels updates the store asynchronously via processModelData.
                // We assume for the auto-select logic below that we might need to rely on the store later, 
                // but checking `response.models` is the primary path.
            }
            
            // Explicitly auto-select the first available model when switching providers
            // This prevents the "invalid model" state when moving between incompatible providers (e.g. Gemini -> Ollama)
            if (modelsList.length > 0) {
                const firstModel = modelsList[0].id;
                settings.setActiveModel(firstModel);
                await updateSettings({ activeModel: firstModel });
            }
            
            toast.success(`Switched provider to ${newProvider === 'gemini' ? 'Google Gemini' : newProvider === 'openrouter' ? 'OpenRouter' : 'Ollama'}.`);
        } catch (error) {
            console.error("Failed to update provider:", error);
            toast.error("Failed to switch provider.");
            setModelsLoading(false);
        } finally {
            setModelsLoading(false);
        }
    }, [processModelData, fetchModels, settings]);

    const onSaveApiKey = useCallback(async (key: string, providerType: 'gemini' | 'openrouter' | 'ollama') => {
        setModelsLoading(true); // Signal start of refresh
        
        // Optimistically clear models to show loading state
        settings.setAvailableModels([]);
        
        try {
            const updatePayload: Partial<AppSettings> = { provider: providerType };
            if (providerType === 'gemini') updatePayload.apiKey = key;
            if (providerType === 'openrouter') updatePayload.openRouterApiKey = key;
            if (providerType === 'ollama') updatePayload.ollamaApiKey = key; 

            const response = await updateSettings(updatePayload);
            
            // Update local store only AFTER success
            if (providerType === 'gemini') settings.setApiKey(key);
            if (providerType === 'openrouter') settings.setOpenRouterApiKey(key);
            if (providerType === 'ollama') settings.setOllamaApiKey(key);
            
            // Refresh models with the new key.
            if (response.models) {
                processModelData(response);
                
                // Auto-select first model if we have a fresh list (helps new users)
                if (response.models.length > 0 && !response.models.some((m: Model) => m.id === settings.activeModel)) {
                    const firstModel = response.models[0].id;
                    settings.setActiveModel(firstModel);
                    updateSettings({ activeModel: firstModel }).catch(console.error);
                }

                if (response.models.length === 0) {
                     toast.warning('API Key saved, but no models were found. Check your key permissions.');
                } else {
                     toast.success('API Key saved and models refreshed.');
                }
            } else {
                await fetchModels();
                toast.success('API Key saved. Refreshing models...');
            }
        } catch (error) {
            console.error("Failed to save API key:", error);
            toast.error('Failed to save API Key. Check server logs.');
        } finally {
            setModelsLoading(false); // Signal end
        }
    }, [processModelData, fetchModels, settings]);

    const onSaveOllamaHost = useCallback(async (host: string) => {
        setModelsLoading(true);
        try {
            const response = await updateSettings({ ollamaHost: host });
            settings.setOllamaHost(host); // Update store after success

            // Always refresh models for Ollama when host changes
            if (response.models) {
                processModelData(response);
                
                // Auto-select first model if needed
                if (response.models.length > 0 && !response.models.some((m: Model) => m.id === settings.activeModel)) {
                    const firstModel = response.models[0].id;
                    settings.setActiveModel(firstModel);
                    updateSettings({ activeModel: firstModel }).catch(console.error);
                }
            } else {
                await fetchModels();
            }
            toast.success('Ollama host updated and models refreshed.');
        } catch (error) {
            console.error("Failed to update Ollama host:", error);
            toast.error('Failed to update Ollama host.');
        } finally {
            setModelsLoading(false); // Signal end
        }
    }, [processModelData, fetchModels, settings]);

    const onSaveServerUrl = useCallback(async (url: string) => {
        settings.setServerUrl(url);
        localStorage.setItem('custom_server_url', url);
        window.location.reload();
        return true;
    }, [settings]);

    const handleShowSources = useCallback((sources: any[]) => {
        setSourcesForSidebar(sources);
        setIsSourcesSidebarOpen(true);
        // If opening sources, ensure artifact is closed to avoid visual clutter on small screens
        if (!isWideDesktop) setIsArtifactOpen(false);
    }, [isWideDesktop]);

    const handleCloseSourcesSidebar = useCallback(() => setIsSourcesSidebarOpen(false), []);

    useEffect(() => {
        const handleOpenArtifact = (e: CustomEvent) => {
            const { code, language } = e.detail;
            setArtifactContent(code);
            setArtifactLanguage(language);
            setIsArtifactOpen(true);
            // If opening artifact, ensure sources is closed to avoid visual clutter on small screens
            if (!isWideDesktop) setIsSourcesSidebarOpen(false);
        };
        window.addEventListener('open-artifact', handleOpenArtifact as EventListener);
        return () => window.removeEventListener('open-artifact', handleOpenArtifact as EventListener);
    }, [isWideDesktop]);

    const handleFileUploadForImport = useCallback((file: File) => {
        const reader = new FileReader();
        reader.onload = (e) => {
            try {
                const content = e.target?.result as string;
                const importedChat = JSON.parse(content);
                chat.importChat(importedChat);
                toast.success('Chat imported successfully.');
            } catch (err) {
                console.error("Import failed:", err);
                toast.error('Failed to import chat. Invalid file format.');
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
        fetchFromApi('/api/handler?task=debug_data_tree')
            .then(res => res.json())
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

    const retryConnection = useCallback(() => {
        setBackendStatus('checking');
        setBackendError(null);
        fetchModels();
    }, [fetchModels]);

    const handleExportChat = useCallback((format: 'md' | 'json' | 'pdf') => {
        if (!chat.currentChatId) return;
        const currentChat = chat.chatHistory.find(c => c.id === chat.currentChatId);
        if (!currentChat) return;

        import('../utils/exportUtils/index').then(mod => {
            if (format === 'json') mod.exportChatToJson(currentChat);
            else if (format === 'md') mod.exportChatToMarkdown(currentChat);
            else if (format === 'pdf') mod.exportChatToPdf(currentChat);
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

    const saveApiKey = async (key: string, providerType: 'gemini' | 'openrouter' | 'ollama') => {
        await onSaveApiKey(key, providerType);
    };

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
        isNewChatDisabled: modelsLoading || settingsLoading || chat.isLoading,
        handleToggleSidebar: () => sidebar.setIsSidebarOpen(!sidebar.isSidebarOpen),
        handleShowSources,

        settingsLoading, 
        modelsLoading, 
        backendStatus, backendError, retryConnection,
        
        availableModels: settings.availableModels,
        availableImageModels: settings.availableImageModels, 
        availableVideoModels: settings.availableVideoModels, 
        availableTtsModels: settings.availableTtsModels,
        
        provider: settings.provider, 
        openRouterApiKey: settings.openRouterApiKey, 
        ollamaHost: settings.ollamaHost,
        ollamaApiKey: settings.ollamaApiKey,
        onProviderChange: onProviderChange, 
        onSaveApiKey: onSaveApiKey, 
        onSaveOllamaHost: onSaveOllamaHost,
        serverUrl: settings.serverUrl, 
        onSaveServerUrl: onSaveServerUrl,
        apiKey: settings.apiKey,
        
        activeModel: settings.activeModel, 
        onModelChange: handleModelChange,
        imageModel: settings.imageModel, 
        onImageModelChange: onImageModelChange,
        videoModel: settings.videoModel, 
        onVideoModelChange: onVideoModelChange,
        ttsModel: settings.ttsModel, 
        onTtsModelChange: onTtsModelChange,
        
        temperature: settings.temperature, 
        setTemperature: handleSetTemperature,
        maxTokens: settings.maxTokens, 
        setMaxTokens: handleSetMaxTokens,
        
        aboutUser: settings.aboutUser, 
        setAboutUser: handleSetAboutUser,
        aboutResponse: settings.aboutResponse, 
        setAboutResponse: handleSetAboutResponse,
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
