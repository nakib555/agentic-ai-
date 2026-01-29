
import React from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Key, Globe, Layout, Link, Database, Trash2, Download, Activity, Terminal, Check } from 'lucide-react';
import { SettingItem } from './SettingItem';
import { ThemeToggle } from '../Sidebar/ThemeToggle';
import type { Theme } from '../../hooks/useTheme';
import { SelectDropdown } from '../UI/SelectDropdown';
import { Input } from "../ui/input";
import { Button } from "../ui/button";

type GeneralSettingsProps = {
  onClearAllChats: () => void;
  onRunTests: () => void;
  onDownloadLogs: () => void;
  onShowDataStructure: () => void;
  onExportAllChats: () => void;
  apiKey: string;
  onSaveApiKey: (key: string, provider: 'gemini' | 'openrouter' | 'ollama') => Promise<void>;
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

const PROVIDER_OPTIONS = [
    { id: 'gemini', label: 'Google Gemini', desc: 'Default' },
    { id: 'openrouter', label: 'OpenRouter', desc: 'Access to Claude, GPT, etc.' },
    { id: 'ollama', label: 'Ollama', desc: 'Local or Hosted Instance' }
];

// Zod Schema for API Key Form
const apiKeySchema = z.object({
  key: z.string().min(1, "API Key is required").regex(/^sk-|^AIza/i, "Invalid API Key format (usually starts with sk- or AIza)"),
});

type ApiKeyFormData = z.infer<typeof apiKeySchema>;

const ApiKeyForm = ({ label, value, placeholder, onSave, description }: { 
    label: string, value: string, placeholder: string, onSave: (key: string) => Promise<void>, description?: string 
}) => {
    const { register, handleSubmit, formState: { errors, isSubmitting, isSubmitSuccessful } } = useForm<ApiKeyFormData>({
        // resolver: zodResolver(apiKeySchema), // Removed strict regex validation to allow diverse key formats
        defaultValues: { key: value }
    });

    const onSubmit = async (data: ApiKeyFormData) => {
        await onSave(data.key);
    };

    return (
        <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-2 w-full">
            <div className="flex flex-col gap-1">
                <label className="text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-widest px-1">{label}</label>
                <div className="flex gap-2 flex-wrap sm:flex-nowrap">
                    <Input
                        {...register('key', { required: true })}
                        type="password"
                        placeholder={placeholder}
                        className={errors.key ? 'border-red-500 focus-visible:ring-red-500' : ''}
                    />
                    <Button
                        type="submit"
                        disabled={isSubmitting}
                        className="w-[80px]"
                    >
                        {isSubmitting ? (
                            <div className="h-4 w-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                        ) : isSubmitSuccessful ? (
                            <Check className="h-4 w-4" />
                        ) : (
                            'Save'
                        )}
                    </Button>
                </div>
                {errors.key && <p className="text-xs text-red-500 px-1">Key is required.</p>}
                {description && <p className="text-[11px] text-slate-500 dark:text-slate-500 px-1">{description}</p>}
            </div>
        </form>
    );
};

const ActionButton = ({ 
    icon: Icon, 
    title, 
    onClick, 
    danger = false 
}: { icon: React.ElementType, title: string, onClick: () => void, danger?: boolean }) => (
    <Button 
        variant={danger ? "destructive" : "outline"}
        onClick={onClick}
        className={`w-full justify-start h-auto py-3 px-4 rounded-xl shadow-none ${!danger ? "bg-white dark:bg-white/5 border-slate-200 dark:border-white/10 hover:bg-slate-50 dark:hover:bg-white/10" : ""}`}
    >
        <Icon className="w-4 h-4 mr-3" />
        <span className="truncate">{title}</span>
    </Button>
);

const GeneralSettings: React.FC<GeneralSettingsProps> = ({ 
    onClearAllChats, onRunTests, onDownloadLogs, onShowDataStructure, onExportAllChats, 
    apiKey, onSaveApiKey, theme, setTheme, serverUrl, onSaveServerUrl,
    provider, openRouterApiKey, ollamaApiKey, onProviderChange, ollamaHost, onSaveOllamaHost
}) => {
    return (
        <div className="space-y-10 pb-12 w-full max-w-full">
            <div className="mb-8">
                <h3 className="text-2xl font-bold text-slate-800 dark:text-slate-100 tracking-tight">General Configuration</h3>
                <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">Manage API keys, connectivity, and system preferences.</p>
            </div>

            <section className="space-y-6 w-full">
                <div className="flex items-center gap-3 mb-2">
                    <div className="p-2 rounded-lg bg-indigo-50 dark:bg-indigo-500/10 text-indigo-600 dark:text-indigo-400">
                        <Key className="w-5 h-5" />
                    </div>
                    <h4 className="text-base font-bold text-slate-700 dark:text-slate-200">AI Provider</h4>
                </div>

                <div className="w-full sm:w-72">
                    <SelectDropdown
                        options={PROVIDER_OPTIONS}
                        value={provider}
                        onChange={(val) => onProviderChange(val as any)}
                        className="w-full"
                    />
                </div>

                {provider === 'gemini' && (
                    <div className="animate-in fade-in slide-in-from-top-2 duration-300 w-full">
                        <ApiKeyForm
                            label="Google Gemini API Key" 
                            value={apiKey} 
                            placeholder="sk-..." 
                            onSave={(key) => onSaveApiKey(key, 'gemini')}
                            description="Required for Gemini models. Stored securely in your browser."
                        />
                    </div>
                )}

                {provider === 'openrouter' && (
                    <div className="animate-in fade-in slide-in-from-top-2 duration-300 w-full">
                         <ApiKeyForm
                            label="OpenRouter API Key" 
                            value={openRouterApiKey} 
                            placeholder="sk-or-..." 
                            onSave={(key) => onSaveApiKey(key, 'openrouter')}
                            description="Required for OpenRouter models."
                        />
                    </div>
                )}
                
                {provider === 'ollama' && (
                     <div className="space-y-6 pt-2 animate-in fade-in slide-in-from-top-2 duration-300 w-full">
                        <div className="flex flex-col gap-2">
                             <label className="text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-widest px-1">Ollama Host URL</label>
                             <div className="flex gap-2">
                                <Input 
                                    type="text" 
                                    defaultValue={ollamaHost}
                                    placeholder="http://localhost:11434"
                                    onBlur={(e) => onSaveOllamaHost && onSaveOllamaHost(e.target.value)}
                                />
                             </div>
                             <p className="text-[11px] text-slate-500 px-1">Ensure your Ollama server allows CORS.</p>
                        </div>
                        <ApiKeyForm
                            label="Ollama API Key (Optional)" 
                            value={ollamaApiKey || ''} 
                            placeholder="sk-..." 
                            onSave={(key) => onSaveApiKey(key, 'ollama')}
                            description="Only required if your Ollama instance is protected by authentication."
                        />
                    </div>
                )}
            </section>

            <div className="h-px bg-gradient-to-r from-transparent via-slate-200 dark:via-white/10 to-transparent w-full" />

            {/* Appearance */}
            <section className="space-y-6 w-full">
                <div className="flex items-center gap-3 mb-2">
                    <div className="p-2 rounded-lg bg-teal-50 dark:bg-teal-500/10 text-teal-600 dark:text-teal-400">
                        <Layout className="w-5 h-5" />
                    </div>
                    <h4 className="text-base font-bold text-slate-700 dark:text-slate-200">Appearance</h4>
                </div>

                <div className="space-y-4 w-full">
                    <SettingItem label="Theme Preference" description="Choose your preferred visual theme." wrapControls={true}>
                        <div className="w-full sm:w-auto min-w-[200px]">
                           <ThemeToggle theme={theme} setTheme={setTheme} variant="cards" />
                        </div>
                    </SettingItem>
                </div>
            </section>
            
            <div className="h-px bg-gradient-to-r from-transparent via-slate-200 dark:via-white/10 to-transparent w-full" />

            {/* Connectivity */}
            <section className="space-y-6 w-full">
                <div className="flex items-center gap-3 mb-2">
                    <div className="p-2 rounded-lg bg-blue-50 dark:bg-blue-500/10 text-blue-600 dark:text-blue-400">
                        <Globe className="w-5 h-5" />
                    </div>
                    <h4 className="text-base font-bold text-slate-700 dark:text-slate-200">Connectivity</h4>
                </div>
                
                <div className="flex flex-col gap-2">
                     <label className="text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-widest px-1">Backend Server URL</label>
                     <div className="flex gap-2">
                        <Input 
                            type="text" 
                            defaultValue={serverUrl}
                            placeholder="http://localhost:3001"
                            onBlur={(e) => onSaveServerUrl(e.target.value)}
                        />
                     </div>
                     <p className="text-[11px] text-slate-500 px-1">Override the default backend URL (e.g., for testing).</p>
                </div>
            </section>

            <div className="h-px bg-gradient-to-r from-transparent via-slate-200 dark:via-white/10 to-transparent w-full" />

            {/* Data & Actions */}
            <section className="space-y-6 w-full">
                <div className="flex items-center gap-3 mb-4">
                    <div className="p-2 rounded-lg bg-red-50 dark:bg-red-500/10 text-red-600 dark:text-red-400">
                        <Database className="w-5 h-5" />
                    </div>
                    <h4 className="text-base font-bold text-slate-700 dark:text-slate-200">Data & Maintenance</h4>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 w-full">
                    <ActionButton 
                        icon={Download}
                        title="Export All Data"
                        onClick={onExportAllChats}
                    />
                    <ActionButton 
                        icon={Link}
                        title="Download Logs"
                        onClick={onDownloadLogs}
                    />
                    <ActionButton 
                        icon={Activity}
                        title="Run Diagnostics"
                        onClick={onRunTests}
                    />
                    <ActionButton 
                        icon={Terminal}
                        title="Debug Structure"
                        onClick={onShowDataStructure}
                    />
                     <ActionButton 
                        icon={Trash2}
                        title="Clear All Chats"
                        onClick={onClearAllChats}
                        danger
                    />
                </div>
            </section>
        </div>
    );
};

export default GeneralSettings;
