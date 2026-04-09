/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useCallback } from 'react';
import { apiClient } from '../services/apiClient';
import { useSettingsStore } from '../store/settingsStore';
import { useUIStore } from '../store/uiStore';
import { toast } from 'sonner';
import type { AppSettings } from '../services/settingsService';

export const useChatActions = (chat: any, fetchModels: () => Promise<void>) => {
  const settings = useSettingsStore();
  const ui = useUIStore();

  const handleModelChange = useCallback(async (modelId: string) => {
    settings.setActiveModel(modelId);
    if (chat.currentChatId) {
      chat.updateChatModel(chat.currentChatId, modelId);
    }
    try {
      await apiClient.put('/api/settings', { activeModel: modelId });
    } catch (e: any) { console.error("Failed to update active model:", e.message || e); }
  }, [chat.updateChatModel, chat.currentChatId, settings]);

  const onProviderChange = useCallback(async (newProvider: 'gemini' | 'openrouter' | 'ollama') => {
    settings.setProvider(newProvider);
    settings.setAvailableModels([]);
    settings.setAvailableImageModels([]);
    settings.setAvailableVideoModels([]);
    settings.setAvailableTtsModels([]);

    try {
      const response: any = await apiClient.put('/api/settings', { provider: newProvider });
      
      if (response.models) {
        settings.setAvailableModels(response.models);
        if (response.imageModels) settings.setAvailableImageModels(response.imageModels);
        if (response.videoModels) settings.setAvailableVideoModels(response.videoModels);
        if (response.ttsModels) settings.setAvailableTtsModels(response.ttsModels);
      } else {
        await fetchModels();
      }
      
      if (response.models?.length > 0) {
        const firstModel = response.models[0].id;
        settings.setActiveModel(firstModel);
        await apiClient.put('/api/settings', { activeModel: firstModel });
        if (chat.currentChatId) {
          chat.updateChatModel(chat.currentChatId, firstModel);
        }
      }
      toast.success(`Switched provider to ${newProvider}.`);
    } catch (error: any) {
      console.error("Failed to update provider:", error.message || error);
      toast.error("Failed to switch provider.");
    }
  }, [fetchModels, settings, chat.currentChatId, chat.updateChatModel]);

  const onSaveApiKey = useCallback(async (key: string, providerType: 'gemini' | 'openrouter' | 'ollama') => {
    settings.setAvailableModels([]);
    try {
      const updatePayload: Partial<AppSettings> = { provider: providerType };
      if (providerType === 'gemini') updatePayload.apiKey = key;
      if (providerType === 'openrouter') updatePayload.openRouterApiKey = key;
      if (providerType === 'ollama') updatePayload.ollamaApiKey = key; 

      const response: any = await apiClient.put('/api/settings', updatePayload);
      
      if (providerType === 'gemini') settings.setApiKey(key);
      if (providerType === 'openrouter') settings.setOpenRouterApiKey(key);
      if (providerType === 'ollama') settings.setOllamaApiKey(key);
      
      if (response.models) {
        settings.setAvailableModels(response.models);
        if (response.imageModels) settings.setAvailableImageModels(response.imageModels);
        if (response.videoModels) settings.setAvailableVideoModels(response.videoModels);
        if (response.ttsModels) settings.setAvailableTtsModels(response.ttsModels);
      } else {
        await fetchModels();
      }
      toast.success('API Key saved.');
    } catch (error: any) {
      console.error("Failed to save API key:", error.message || error);
      toast.error('Failed to save API Key.');
    }
  }, [fetchModels, settings]);

  return {
    handleModelChange,
    onProviderChange,
    onSaveApiKey
  };
};
