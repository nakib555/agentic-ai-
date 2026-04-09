/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState, useEffect, useCallback } from 'react';
import { apiClient } from '../services/apiClient';
import { useSettingsStore } from '../store/settingsStore';
import { useUIStore } from '../store/uiStore';

export const useSystemStatus = () => {
  const provider = useSettingsStore(state => state.provider);
  const apiKey = useSettingsStore(state => state.apiKey);
  const openRouterApiKey = useSettingsStore(state => state.openRouterApiKey);
  
  const setAvailableModels = useSettingsStore(state => state.setAvailableModels);
  const setAvailableImageModels = useSettingsStore(state => state.setAvailableImageModels);
  const setAvailableVideoModels = useSettingsStore(state => state.setAvailableVideoModels);
  const setAvailableTtsModels = useSettingsStore(state => state.setAvailableTtsModels);
  
  const [backendStatus, setBackendStatus] = useState<'online' | 'offline' | 'checking'>('checking');
  const [backendError, setBackendError] = useState<string | null>(null);
  const [versionMismatch, setVersionMismatch] = useState(false);
  const [modelsLoading, setModelsLoading] = useState(false);

  const fetchModels = useCallback(async () => {
    setModelsLoading(true);
    try {
      const data: any = await apiClient.get('/api/models', { 
        params: { _t: Date.now().toString() } 
      });
      
      if (data.models) setAvailableModels(data.models);
      if (data.imageModels) setAvailableImageModels(data.imageModels);
      if (data.videoModels) setAvailableVideoModels(data.videoModels);
      if (data.ttsModels) setAvailableTtsModels(data.ttsModels);
      
      setBackendStatus('online');
      setBackendError(null);
    } catch (e: any) {
      console.error("Failed to fetch models:", e.message || e);
      setBackendStatus('offline');
      setBackendError(e.message || "Could not connect to backend server.");
    } finally {
      setModelsLoading(false);
    }
  }, [setAvailableModels, setAvailableImageModels, setAvailableVideoModels, setAvailableTtsModels]);

  useEffect(() => {
    apiClient.setVersionMismatchHandler(() => setVersionMismatch(true));
    
    const init = async () => {
      try {
        const serverSettings: any = await apiClient.get('/api/settings');
        if (serverSettings) {
          if ((provider === 'gemini' && apiKey) || 
              (provider === 'openrouter' && openRouterApiKey) ||
              (provider === 'ollama')) {
            await fetchModels();
          } else {
            setBackendStatus('online');
          }
        }
      } catch (e: any) {
        console.error("Failed to load settings:", e.message || e);
        setBackendStatus('offline');
        setBackendError("Could not connect to backend server.");
      }
    };
    init();
  }, [provider, apiKey, openRouterApiKey, fetchModels]);

  const retryConnection = useCallback(() => {
    setBackendStatus('checking');
    setBackendError(null);
    fetchModels();
  }, [fetchModels]);

  return {
    backendStatus,
    backendError,
    versionMismatch,
    modelsLoading,
    retryConnection,
    fetchModels
  };
};
