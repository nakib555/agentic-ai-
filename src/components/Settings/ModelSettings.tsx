/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useRef, useMemo } from 'react';
import type { Model } from '../../types';
import { SelectDropdown } from '../UI/SelectDropdown';
import { SettingItem } from './SettingItem';

// Modern Icons
const SparklesIcon = () => <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="w-5 h-5"><path d="m12 3-1.912 5.813a2 2 0 0 1-1.275 1.275L3 12l5.813 1.912a2 2 0 0 1 1.275 1.275L12 21l1.912-5.813a2 2 0 0 1 1.275-1.275L21 12l-5.813-1.912a2 2 0 0 1-1.275-1.275L12 3Z" /><path d="M5 3v4" /><path d="M9 5H3" /><path d="M19 19v4" /><path d="M21 21h-4" /></svg>;
const PhotoIcon = () => <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="w-5 h-5"><rect width="18" height="18" x="3" y="3" rx="2" ry="2" /><circle cx="9" cy="9" r="2" /><path d="m21 15-3.086-3.086a2 2 0 0 0-2.828 0L6 21" /></svg>;
const VideoIcon = () => <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="w-5 h-5"><path d="m22 8-6 4 6 4V8Z" /><rect width="14" height="12" x="2" y="6" rx="2" ry="2" /></svg>;
const SpeakerIcon = () => <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="w-5 h-5"><path d="M11 5L6 9H2v6h4l5 4V5z" /><path d="M15.54 8.46a5 5 0 0 1 0 7.07" /><path d="M19.07 4.93a10 10 0 0 1 0 14.14" /></svg>;

// Modern Temperature Control with animated visual feedback and local state buffering
const TemperatureControl = ({ value, onChange, disabled }: { value: number, onChange: (v: number) => void, disabled?: boolean }) => {
    // Local state for immediate UI feedback during drag
    const [localValue, setLocalValue] = useState(value);
    const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

    // Sync local state if external prop changes (e.g. reset/load settings)
    useEffect(() => {
        setLocalValue(value);
    }, [value]);

    const handleSliderChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const newValue = parseFloat(e.target.value);
        setLocalValue(newValue);

        // Debounce the parent update to prevent API flooding
        if (timeoutRef.current) clearTimeout(timeoutRef.current);
        timeoutRef.current = setTimeout(() => {
            onChange(newValue);
        }, 300); // 300ms delay before saving/updating global state
    };

    const getLabel = (v: number) => {
        if (v < 0.3) return { text: "Precise", color: "text-emerald-500", bg: "bg-emerald-50 dark:bg-emerald-500/10", desc: "Factual & Deterministic" };
        if (v < 0.7) return { text: "Balanced", color: "text-blue-500", bg: "bg-blue-50 dark:bg-blue-500/10", desc: "Natural & Engaging" };
        return { text: "Creative", color: "text-purple-500", bg: "bg-purple-50 dark:bg-purple-500/10", desc: "Imaginative & Diverse" };
    };
    const label = getLabel(localValue);

    return (
        <div className="w-full bg-slate-50/50 dark:bg-white/5 border border-slate-200 dark:border-white/10 rounded-2xl p-5 transition-all hover:border-indigo-300 dark:hover:border-indigo-500/30">
            <div className="flex items-start justify-between mb-6">
                <div>
                    <span className="text-base font-bold text-slate-800 dark:text-slate-100 flex items-center gap-2">
                        Response Creativity
                        <span className={`px-2 py-0.5 rounded text-[10px] uppercase font-extrabold tracking-wider ${label.color} ${label.bg}`}>
                            {label.text}
                        </span>
                    </span>
                    <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 font-medium">{label.desc}</p>
                </div>
                <div className="font-mono text-xl font-bold text-slate-700 dark:text-slate-200 tracking-tight">
                    {localValue.toFixed(1)}
                </div>
            </div>
            
            <div className="relative h-10 flex items-center group touch-none">
                {/* Track Background */}
                <div className="absolute inset-x-0 top-1/2 -translate-y-1/2 h-3 bg-slate-200 dark:bg-black/40 rounded-full overflow-hidden shadow-inner">
                    {/* Gradient Fill */}
                    <div 
                        className="h-full bg-gradient-to-r from-emerald-400 via-blue-500 to-purple-600 transition-all duration-100 ease-out origin-left" 
                        style={{ width: `${localValue * 100}%` }} 
                    />
                </div>
                
                {/* Interaction Layer */}
                <input
                    type="range"
                    min="0"
                    max="1"
                    step="0.1"
                    value={localValue}
                    onChange={handleSliderChange}
                    disabled={disabled}
                    className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-20"
                    aria-label="Temperature"
                />
                
                {/* Animated Thumb */}
                <div 
                    className="absolute top-1/2 -translate-y-1/2 h-7 w-7 bg-white dark:bg-slate-200 shadow-[0_4px_10px_rgba(0,0,0,0.2)] border-2 border-transparent rounded-full pointer-events-none transition-all duration-100 ease-out z-10 flex items-center justify-center"
                    style={{ left: `calc(${localValue * 100}% - 14px)` }}
                >
                    <div className={`w-2 h-2 rounded-full ${localValue > 0.7 ? 'bg-purple-500' : localValue > 0.3 ? 'bg-blue-500' : 'bg-emerald-500'}`} />
                </div>
            </div>
            
            <div className="flex justify-between mt-2 px-1">
                {[0, 0.5, 1].map((tick) => (
                    <div 
                        key={tick} 
                        className="flex flex-col items-center gap-1 cursor-pointer" 
                        onClick={() => {
                            if (!disabled) {
                                setLocalValue(tick);
                                onChange(tick);
                            }
                        }}
                    >
                        <div className={`w-1 h-1 rounded-full ${Math.abs(localValue - tick) < 0.1 ? 'bg-slate-800 dark:bg-slate-200 scale-150' : 'bg-slate-300 dark:bg-slate-600'}`} />
                    </div>
                ))}
            </div>
        </div>
    );
};

type ModelSettingsProps = {
  models: Model[];
  imageModels: Model[];
  videoModels: Model[];
  ttsModels: Model[];
  selectedModel: string;
  onModelChange: (modelId: string) => void;
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
  disabled: boolean;
  provider: 'gemini' | 'openrouter' | 'ollama';
};

const ModelSettings: React.FC<ModelSettingsProps> = ({
    models = [], imageModels = [], videoModels = [], ttsModels = [], selectedModel, onModelChange,
    temperature, setTemperature, maxTokens, setMaxTokens,
    imageModel, onImageModelChange, videoModel, onVideoModelChange, ttsModel, onTtsModelChange,
    disabled, provider
}) => {
    // Filter models to ensure "Primary Reasoning Model" only shows text/reasoning models.
    const filteredReasoningModels = useMemo(() => {
        const specializedIds = new Set([
            ...imageModels.map(m => m.id),
            ...videoModels.map(m => m.id),
            ...ttsModels.map(m => m.id)
        ]);

        return models.filter(m => {
            // 1. Exclude if present in specialized lists (e.g. dont show an image model in chat list)
            if (specializedIds.has(m.id)) return false;

            // 2. Minimal filtering: Just ensure it's not obviously an embedding model
            const id = m.id.toLowerCase();
            if (id.includes('embedding') || id.includes('embed')) return false;

            // We relax other string-based filters because backend providers (especially OpenRouter/Ollama)
            // might have chat models with "image" or "vision" in the name (e.g. Llama 3.2 Vision).
            // We rely on the backend to send us the correct 'chatModels' list.
            
            return true;
        });
    }, [models, imageModels, videoModels, ttsModels]);

    const formatModels = (list: Model[]) => list.map(m => ({ id: m.id, label: m.name, desc: m.description }));

    const noModelsAvailable = !filteredReasoningModels || filteredReasoningModels.length === 0;
    
    let descriptionText = "The main model used for chat, reasoning, and planning.";
    if (provider === 'openrouter') descriptionText = "Selected OpenRouter model for reasoning.";
    if (provider === 'ollama') descriptionText = "Selected local Ollama model for reasoning.";

    return (
        <div className="space-y-10 pb-12">
            {/* Header */}
            <div className="mb-8 flex flex-col sm:flex-row sm:items-center justify-between gap-6">
                 <div className="flex items-center gap-4">
                    <div className="p-3 bg-gradient-to-br from-emerald-500 to-teal-600 rounded-2xl shadow-lg shadow-emerald-500/20 text-white">
                        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-6 h-6">
                            <path d="M12 2a10 10 0 0 1 10 10c0 5.523-4.477 10-10 10S2 17.523 2 12 6.477 2 12 2Z" />
                            <path d="M12 14a2 2 0 0 0-2 2h4a2 2 0 0 0-2-2Z" />
                            <path d="M12 9a1 1 0 1 0 0 2 1 1 0 0 0 0-2Z" />
                        </svg>
                    </div>
                    <div>
                        <h3 className="text-2xl font-bold text-slate-900 dark:text-white tracking-tight">Intelligence</h3>
                        <p className="text-sm text-slate-500 dark:text-slate-400 font-medium mt-1">Cognitive engine & generative capabilities.</p>
                    </div>
                </div>
            </div>
            
            {noModelsAvailable && (
              <div className="p-4 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800/50 rounded-2xl flex items-start gap-4 animate-in fade-in slide-in-from-top-2 duration-300">
                <div className="p-2 bg-amber-100 dark:bg-amber-800/30 rounded-full flex-shrink-0 text-amber-600 dark:text-amber-400">
                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-5 h-5"><path fillRule="evenodd" d="M8.485 2.495c.673-1.167 2.357-1.167 3.03 0l6.28 10.875c.673 1.167-.17 2.625-1.516 2.625H3.72c-1.347 0-2.189-1.458-1.515-2.625L8.485 2.495ZM10 5a.75.75 0 0 1 .75.75v3.5a.75.75 0 0 1-1.5 0v-3.5A.75.75 0 0 1 10 5Zm0 9a1 1 0 1 0 0-2 1 1 0 0 0 0 2Z" clipRule="evenodd" /></svg>
                </div>
                <div>
                    <p className="font-bold text-sm text-amber-800 dark:text-amber-200">Models Unavailable</p>
                    <p className="text-xs sm:text-sm text-amber-700 dark:text-amber-300/80 mt-1 leading-relaxed">
                      Please check your configuration in the General tab to load available models.
                    </p>
                </div>
              </div>
            )}

            {/* Core Intelligence Section */}
            <section className="space-y-6">
                <div className="flex items-center gap-3 mb-2">
                    <div className="p-2 rounded-lg bg-indigo-50 dark:bg-indigo-500/10 text-indigo-600 dark:text-indigo-400">
                        <SparklesIcon />
                    </div>
                    <h4 className="text-base font-bold text-slate-700 dark:text-slate-200">Cognitive Engine</h4>
                </div>
                
                <div className="space-y-6">
                    <SettingItem 
                        label="Primary Reasoning Model" 
                        description={descriptionText}
                    >
                        <div className="w-full sm:w-[320px]">
                            <SelectDropdown 
                                options={formatModels(filteredReasoningModels)} 
                                value={selectedModel} 
                                onChange={onModelChange} 
                                disabled={disabled || noModelsAvailable} 
                                placeholder="Select a reasoning model"
                                startIcon={<SparklesIcon />}
                                className="w-full"
                            />
                        </div>
                    </SettingItem>

                    <TemperatureControl 
                        value={temperature} 
                        onChange={setTemperature} 
                        disabled={disabled} 
                    />
                </div>
            </section>

            <div className="h-px bg-gradient-to-r from-transparent via-slate-200 dark:via-white/10 to-transparent w-full" />

            {/* Multimodal Capabilities Section */}
            <section className="space-y-6">
                <div className="flex items-center gap-3 mb-2">
                    <div className="p-2 rounded-lg bg-pink-50 dark:bg-pink-500/10 text-pink-600 dark:text-pink-400">
                        <div className="flex -space-x-1">
                            <PhotoIcon />
                            <VideoIcon />
                        </div>
                    </div>
                    <div className="flex-1">
                        <h4 className="text-base font-bold text-slate-700 dark:text-slate-200">Multimodal Suite</h4>
                    </div>
                </div>

                <div className="space-y-6">
                    <SettingItem label="Image Generation">
                        <div className="w-full sm:w-[320px]">
                            <SelectDropdown 
                                options={formatModels(imageModels)} 
                                value={imageModel} 
                                onChange={onImageModelChange} 
                                disabled={disabled || noModelsAvailable} 
                                placeholder="Select image model"
                                startIcon={<PhotoIcon />}
                                className="w-full"
                            />
                        </div>
                    </SettingItem>

                    <SettingItem label="Video Generation">
                        <div className="w-full sm:w-[320px]">
                            <SelectDropdown 
                                options={formatModels(videoModels)} 
                                value={videoModel} 
                                onChange={onVideoModelChange} 
                                disabled={disabled || noModelsAvailable} 
                                placeholder="Select video model"
                                startIcon={<VideoIcon />}
                                className="w-full"
                            />
                        </div>
                    </SettingItem>

                    <SettingItem label="Speech Synthesis (TTS)">
                        <div className="w-full sm:w-[320px]">
                            <SelectDropdown 
                                options={formatModels(ttsModels)} 
                                value={ttsModel} 
                                onChange={onTtsModelChange} 
                                disabled={disabled || noModelsAvailable} 
                                placeholder="Select TTS model"
                                startIcon={<SpeakerIcon />}
                                className="w-full"
                            />
                        </div>
                    </SettingItem>
                </div>
            </section>
        </div>
    );
};

export default React.memo(ModelSettings);