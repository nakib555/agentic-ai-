
/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { DEFAULT_TEMPERATURE, DEFAULT_MAX_TOKENS, DEFAULT_ABOUT_USER, DEFAULT_ABOUT_RESPONSE, DEFAULT_TTS_VOICE } from '../components/App/constants';
import type { Model } from '../types';

interface SettingsState {
  // Provider Settings
  provider: 'gemini' | 'openrouter' | 'ollama';
  apiKey: string;
  openRouterApiKey: string;
  ollamaApiKey: string;
  ollamaHost: string;
  serverUrl: string;
  
  // Model Settings
  activeModel: string;
  imageModel: string;
  videoModel: string;
  ttsModel: string;
  temperature: number;
  maxTokens: number;
  
  // Personalization
  aboutUser: string;
  aboutResponse: string;
  ttsVoice: string;
  isMemoryEnabled: boolean;
  
  // Data (Models list - cached)
  availableModels: Model[];
  availableImageModels: Model[];
  availableVideoModels: Model[];
  availableTtsModels: Model[];

  // Actions
  setProvider: (provider: 'gemini' | 'openrouter' | 'ollama') => void;
  setApiKey: (key: string) => void;
  setOpenRouterApiKey: (key: string) => void;
  setOllamaApiKey: (key: string) => void;
  setOllamaHost: (host: string) => void;
  setServerUrl: (url: string) => void;
  
  setActiveModel: (model: string) => void;
  setImageModel: (model: string) => void;
  setVideoModel: (model: string) => void;
  setTtsModel: (model: string) => void;
  
  setTemperature: (temp: number) => void;
  setMaxTokens: (tokens: number) => void;
  
  setAboutUser: (text: string) => void;
  setAboutResponse: (text: string) => void;
  setTtsVoice: (voice: string) => void;
  setIsMemoryEnabled: (enabled: boolean) => void;
  
  setAvailableModels: (models: Model[]) => void;
  setAvailableImageModels: (models: Model[]) => void;
  setAvailableVideoModels: (models: Model[]) => void;
  setAvailableTtsModels: (models: Model[]) => void;
}

export const useSettingsStore = create<SettingsState>()(
  persist(
    (set) => ({
      provider: 'gemini',
      apiKey: '',
      openRouterApiKey: '',
      ollamaApiKey: '',
      ollamaHost: '',
      serverUrl: '',
      
      activeModel: 'gemini-2.5-flash',
      imageModel: 'gemini-2.5-flash-image',
      videoModel: 'veo-3.1-generate-preview',
      ttsModel: 'gemini-2.5-flash-preview-tts',
      temperature: DEFAULT_TEMPERATURE,
      maxTokens: DEFAULT_MAX_TOKENS,
      
      aboutUser: DEFAULT_ABOUT_USER,
      aboutResponse: DEFAULT_ABOUT_RESPONSE,
      ttsVoice: DEFAULT_TTS_VOICE,
      isMemoryEnabled: false,
      
      availableModels: [],
      availableImageModels: [],
      availableVideoModels: [],
      availableTtsModels: [],

      setProvider: (provider) => set({ provider }),
      setApiKey: (apiKey) => set({ apiKey }),
      setOpenRouterApiKey: (openRouterApiKey) => set({ openRouterApiKey }),
      setOllamaApiKey: (ollamaApiKey) => set({ ollamaApiKey }),
      setOllamaHost: (ollamaHost) => set({ ollamaHost }),
      setServerUrl: (serverUrl) => set({ serverUrl }),
      
      setActiveModel: (activeModel) => set({ activeModel }),
      setImageModel: (imageModel) => set({ imageModel }),
      setVideoModel: (videoModel) => set({ videoModel }),
      setTtsModel: (ttsModel) => set({ ttsModel }),
      
      setTemperature: (temperature) => set({ temperature }),
      setMaxTokens: (maxTokens) => set({ maxTokens }),
      
      setAboutUser: (aboutUser) => set({ aboutUser }),
      setAboutResponse: (aboutResponse) => set({ aboutResponse }),
      setTtsVoice: (ttsVoice) => set({ ttsVoice }),
      setIsMemoryEnabled: (isMemoryEnabled) => set({ isMemoryEnabled }),
      
      setAvailableModels: (availableModels) => set({ availableModels }),
      setAvailableImageModels: (availableImageModels) => set({ availableImageModels }),
      setAvailableVideoModels: (availableVideoModels) => set({ availableVideoModels }),
      setAvailableTtsModels: (availableTtsModels) => set({ availableTtsModels }),
    }),
    {
      name: 'agentic-ai-settings',
      partialize: (state) => ({
        // Don't persist model lists to keep storage clean, we re-fetch them
        provider: state.provider,
        apiKey: state.apiKey,
        openRouterApiKey: state.openRouterApiKey,
        ollamaApiKey: state.ollamaApiKey,
        ollamaHost: state.ollamaHost,
        activeModel: state.activeModel,
        imageModel: state.imageModel,
        videoModel: state.videoModel,
        ttsModel: state.ttsModel,
        temperature: state.temperature,
        maxTokens: state.maxTokens,
        aboutUser: state.aboutUser,
        aboutResponse: state.aboutResponse,
        ttsVoice: state.ttsVoice,
        isMemoryEnabled: state.isMemoryEnabled
      }),
    }
  )
);
