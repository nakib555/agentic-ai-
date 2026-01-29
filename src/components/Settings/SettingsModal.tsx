
/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */
import React, { useState } from 'react';
import { AnimatePresence, motion as motionTyped, LayoutGroup } from 'framer-motion';
import type { Model } from '../../types';
import { SettingsCategoryButton } from './SettingsCategoryButton';
import type { Theme } from '../../hooks/useTheme';
import { Dialog, DialogContent, DialogTitle, DialogDescription } from "../ui/dialog";

// Static imports for instant tab switching
import GeneralSettings from './GeneralSettings';
import ModelSettings from './ModelSettings';
import PersonalizeSettings from './PersonalizeSettings';
import SpeechMemorySettings from './SpeechMemorySettings';

const motion = motionTyped as any;

type SettingsModalProps = {
  isOpen: boolean;
  onClose: () => void;
  models: Model[];
  imageModels: Model[];
  videoModels: Model[];
  ttsModels: Model[];
  selectedModel: string;
  onModelChange: (modelId: string) => void;
  onClearAllChats: () => void;
  onRunTests: () => void;
  onDownloadLogs: () => void;
  onShowDataStructure: () => void;
  onExportAllChats: () => void;
  apiKey: string;
  onSaveApiKey: (key: string, provider: 'gemini' | 'openrouter' | 'ollama') => Promise<void>;
  aboutUser: string;
  setAboutUser: (prompt: string) => void;
  aboutResponse: string;
  setAboutResponse: (prompt: string) => void;
  temperature: number;
  setTemperature: (temp: number) => void;
  maxTokens: number;
  setMaxTokens: (tokens: number) => void;
  imageModel: string;
  onImageModelChange: (modelId: string) => void;
  videoModel: string;
  onVideoModelChange: (modelId: string) => void;
  ttsModel: string;
  onTtsModelChange: (modelId: string) => void;
  defaultTemperature: number;
  defaultMaxTokens: number;
  isMemoryEnabled: boolean;
  setIsMemoryEnabled: (enabled: boolean) => void;
  onManageMemory: () => void;
  ttsVoice: string;
  setTtsVoice: (voice: string) => void;
  disabled: boolean;
  theme: Theme;
  setTheme: (theme: Theme) => void;
  serverUrl: string;
  onSaveServerUrl: (url: string) => Promise<boolean>;
  provider: 'gemini' | 'openrouter' | 'ollama';
  openRouterApiKey: string;
  ollamaApiKey?: string;
  onProviderChange: (provider: 'gemini' | 'openrouter' | 'ollama') => void;
  ollamaHost?: string;
  onSaveOllamaHost?: (host: string) => Promise<void> | void;
};

const CATEGORIES = [
  { 
    id: 'general', 
    label: 'General', 
    icon: (
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="w-5 h-5">
        <circle cx="12" cy="12" r="3" />
        <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"></path>
      </svg>
    ) 
  },
  { 
    id: 'model', 
    label: 'Model & AI', 
    icon: (
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="w-5 h-5">
        <path d="M12 2a10 10 0 0 1 10 10c0 5.523-4.477 10-10 10S2 17.523 2 12 6.477 2 12 2Z" />
        <path d="M12 14a2 2 0 0 0-2 2h4a2 2 0 0 0-2-2Z" />
        <path d="M12 9a1 1 0 1 0 0 2 1 1 0 0 0 0-2Z" />
      </svg>
    ) 
  },
  { 
    id: 'personalize', 
    label: 'Persona', 
    icon: (
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="w-5 h-5">
        <path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2" />
        <circle cx="12" cy="7" r="4" />
      </svg>
    ) 
  },
  { 
    id: 'speech', 
    label: 'Voice & Memory', 
    icon: (
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="w-5 h-5">
        <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z" />
        <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
        <line x1="12" y1="19" x2="12" y2="23" />
        <line x1="8" y1="23" x2="16" y2="23" />
      </svg>
    ) 
  },
];

export const SettingsModal: React.FC<SettingsModalProps> = (props) => {
  const [activeTab, setActiveTab] = useState('general');

  return (
    <Dialog open={props.isOpen} onOpenChange={props.onClose}>
      <DialogContent className="p-0 gap-0 w-[90vw] md:w-full max-w-5xl h-[80vh] md:h-[80vh] flex flex-col md:flex-row overflow-hidden bg-page rounded-2xl border border-border-default shadow-2xl focus:outline-none">
        <DialogTitle className="sr-only">Settings</DialogTitle>
        <DialogDescription className="sr-only">Configure application settings, API keys, and models.</DialogDescription>
        
        {/* Sidebar Navigation */}
        <div className="w-full md:w-64 bg-layer-2/50 border-b md:border-b-0 md:border-r border-border-subtle flex flex-col flex-shrink-0">
          <div className="p-4 md:p-6 pb-2 md:pb-6">
            <h2 className="text-xl font-bold text-content-primary px-2 mb-4 hidden md:block tracking-tight">Settings</h2>
            <nav className="flex md:flex-col gap-2 overflow-x-auto md:overflow-visible pb-2 md:pb-0 scrollbar-hide snap-x">
              <LayoutGroup>
                {CATEGORIES.map((cat) => (
                  <SettingsCategoryButton
                    key={cat.id}
                    icon={cat.icon}
                    label={cat.label}
                    isActive={activeTab === cat.id}
                    onClick={() => setActiveTab(cat.id)}
                  />
                ))}
              </LayoutGroup>
            </nav>
          </div>
          
          <div className="mt-auto p-4 md:p-6 hidden md:block">
            <div className="text-xs text-content-tertiary px-2">
              <p>Agentic AI v1.0</p>
              <p className="mt-1 opacity-60">Running locally</p>
            </div>
          </div>
        </div>

        {/* Main Content Area */}
        <div className="flex-1 overflow-y-auto custom-scrollbar bg-page relative">
          <div className="p-4 md:p-8 lg:p-10 max-w-3xl mx-auto min-h-full">
            <AnimatePresence mode="wait">
              <motion.div
                key={activeTab}
                initial={{ opacity: 0, x: 10 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -10 }}
                transition={{ duration: 0.2, ease: "easeOut" }}
                className="w-full"
              >
                {activeTab === 'general' && (
                  <GeneralSettings 
                    onClearAllChats={props.onClearAllChats}
                    onRunTests={props.onRunTests}
                    onDownloadLogs={props.onDownloadLogs}
                    onShowDataStructure={props.onShowDataStructure}
                    onExportAllChats={props.onExportAllChats}
                    apiKey={props.apiKey}
                    onSaveApiKey={props.onSaveApiKey}
                    theme={props.theme}
                    setTheme={props.setTheme}
                    serverUrl={props.serverUrl}
                    onSaveServerUrl={props.onSaveServerUrl}
                    provider={props.provider}
                    openRouterApiKey={props.openRouterApiKey}
                    ollamaApiKey={props.ollamaApiKey}
                    onProviderChange={props.onProviderChange}
                    ollamaHost={props.ollamaHost}
                    onSaveOllamaHost={props.onSaveOllamaHost}
                  />
                )}
                {activeTab === 'model' && (
                  <ModelSettings 
                    models={props.models}
                    imageModels={props.imageModels}
                    videoModels={props.videoModels}
                    ttsModels={props.ttsModels}
                    selectedModel={props.selectedModel}
                    onModelChange={props.onModelChange}
                    temperature={props.temperature}
                    setTemperature={props.setTemperature}
                    maxTokens={props.maxTokens}
                    setMaxTokens={props.setMaxTokens}
                    imageModel={props.imageModel}
                    onImageModelChange={props.onImageModelChange}
                    videoModel={props.videoModel}
                    onVideoModelChange={props.onVideoModelChange}
                    ttsModel={props.ttsModel}
                    onTtsModelChange={props.onTtsModelChange}
                    defaultTemperature={props.defaultTemperature}
                    defaultMaxTokens={props.defaultMaxTokens}
                    disabled={props.disabled}
                    provider={props.provider}
                  />
                )}
                {activeTab === 'personalize' && (
                  <PersonalizeSettings 
                    aboutUser={props.aboutUser}
                    setAboutUser={props.setAboutUser}
                    aboutResponse={props.aboutResponse}
                    setAboutResponse={props.setAboutResponse}
                    disabled={props.disabled}
                  />
                )}
                {activeTab === 'speech' && (
                  <SpeechMemorySettings 
                    isMemoryEnabled={props.isMemoryEnabled}
                    setIsMemoryEnabled={props.setIsMemoryEnabled}
                    onManageMemory={props.onManageMemory}
                    disabled={props.disabled}
                    ttsVoice={props.ttsVoice}
                    setTtsVoice={props.setTtsVoice}
                    ttsModels={props.ttsModels}
                    ttsModel={props.ttsModel}
                    onTtsModelChange={props.onTtsModelChange}
                  />
                )}
              </motion.div>
            </AnimatePresence>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default SettingsModal;
