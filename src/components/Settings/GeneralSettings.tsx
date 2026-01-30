
import React, { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Key, Globe, Layout, Link, Database, Trash2, Download, Activity, Terminal, Check, Eye, EyeOff, RotateCcw } from 'lucide-react';
import { SettingItem } from './SettingItem';
import { ThemeToggle } from '../Sidebar/ThemeToggle';
import type { Theme } from '../../hooks/useTheme';
import { SelectDropdown } from '../UI/SelectDropdown';
import { Input } from "../ui/input";
import { Button } from "../ui/button";
import { resetApiBaseUrl, isUsingCustomBaseUrl } from '../../utils/api';

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
  key: z.string().min(1, "API Key is required"),
});

type ApiKeyFormData = z.infer<typeof apiKeySchema>;

const ApiKeyForm = ({ label, value, placeholder, onSave, description }: { 
    label: string, value: string, placeholder: string, onSave: (key: string) => Promise<void>, description?: string 
}) => {
    const [showSuccess, setShowSuccess] = useState(false);
    const [isVisible, setIsVisible] = useState(false);
    
    const { register, handleSubmit, reset, formState: { errors, isSubmitting }, getValues } = useForm<ApiKeyFormData>({
        resolver: zodResolver(apiKeySchema), 
        defaultValues: { key: value }
    });

    // Sync form with external value prop ONLY if it differs from current form value
    // This prevents clearing user input if they type faster than the async save loop
    useEffect(() => {
        const currentFormValue = getValues().key;
        if (value !== currentFormValue) {
            reset({ key: value });
        }
    }, [value, reset, getValues]);

    const onSubmit = async (data: ApiKeyFormData) => {
        try {
            // Aggressively sanitize input: remove all whitespace/newlines
            const cleanKey = data.key.replace(/\s+/g, '');
            await onSave(cleanKey);
            setShowSuccess(true);
            setTimeout(() => setShowSuccess(false), 2000);
        } catch (e) {
            // Error handling is done by parent via toast
        }
    };

    return (
        <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-2 w-full">
            <div className="flex flex-col gap-1">
                <label className="text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-widest px-1">{label}</label>
                <div className="flex gap-2 flex-wrap sm:flex-nowrap items-stretch">
                    <div className="relative flex-1">
                        <Input
                            {...register('key')}
                            type={isVisible ? "text" : "password"}
                            placeholder={placeholder}
                            autoComplete="off"
                            autoCapitalize="off"
                            autoCorrect="off"
                            spellCheck="false"
                            className={`pr-10 ${errors.key ? 'border-red-500 focus-visible:ring-red-500' : ''}`}
                        />
                        <button
                            type="button"
                            onClick={() => setIsVisible(!isVisible)}
                            className="absolute right-0 top-0 h-full px-3 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 transition-colors focus:outline-none"
                            tabIndex={-1}
                            title={isVisible ? "Hide API Key" : "Show API Key"}
                        >
                            {isVisible ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                        </button>
                    </div>
                    <Button
                        type="submit"
                        disabled={isSubmitting}
                        className="w-[80px] active:scale-95 transition-transform shrink-0"
                    >
                        {isSubmitting ? (
                            <div className="h-4 w-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                        ) : showSuccess ? (
                            <Check className="h-4 w-4" />
                        ) : (
                            'Save'
                        )}
                    </Button>
                </div>
                {errors.key && <p className="text-xs text-red-500 px-1">{errors.key.message}</p>}
                {description && <p className="text-[11px] text-slate-500 dark:text-slate-500 px-1">{description}</p>}
            </div>
        </form>
    );
};

const OllamaHostForm = ({ value, onSave }: { value: string, onSave: (host: string) => Promise<void> | void }) => {
    const [host, setHost] = useState(value);
    const [isSaving, setIsSaving] = useState(false);
    const [success, setSuccess] = useState(false);

    useEffect(() => {
        setHost(value);
    }, [value]);

    const handleSave = async () => {
        setIsSaving(true);
        setSuccess(false);
        try {
            await onSave(host);
            setSuccess(true);
            setTimeout(() => setSuccess(false), 2000);
        } finally {
            setIsSaving(false);
        }
    };

    return (
        <div className="flex flex-col gap-2 w-full">
             <label className="text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-widest px-1">Ollama Host URL</label>
             <div className="flex gap-2 flex-wrap sm:flex-nowrap">
                <Input 
                    type="text" 
                    value={host}
                    onChange={(e) => setHost(e.target.value)}
                    placeholder="http://localhost:11434"
                    autoComplete="off"
                    autoCapitalize="off"
                    autoCorrect="off"
                    spellCheck="false"
                    onKeyDown={(e) => e.key === 'Enter' && handleSave()}
                />
                <Button
                    onClick={handleSave}
                    disabled={isSaving}
                    className="w-[80px] active:scale-95 transition-transform shrink-0"
                    type="button"
                >
                    {isSaving ? (
                        <div className="h-4 w-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    ) : success ? (
                        <Check className="h-4 w-4" />
                    ) : (
                        'Save'
                    )}
                </Button>
             </div>
             <p className="text-[11px] text-slate-500 px-1">Ensure your Ollama server allows CORS.</p>
        </div>
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
        className={`w-full justify-start h-auto py-3 px-4 rounded-xl shadow-none active:scale-[0.98] transition-all ${!danger ? "bg-white dark:bg-white/5 border-slate-200 dark:border-white/10 hover:bg-slate-50 dark:hover:bg-white/10" : ""}`}
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
    const isCustomUrl = isUsingCustomBaseUrl();

    return (
        <div className="space-y-10 pb-12 w-full max-w-full">
            <div className="mb-8 flex flex-col sm:flex-row sm:items-center justify-between gap-6">
                <div className="flex items-center gap-4">
                    <div className="p-3 bg-gradient-to-br from-blue-500 to-cyan-500 rounded-2xl shadow-lg shadow-blue-500/20 text-white">
                        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-6 h-6">
                            <path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.38a2 2 0 0 0-.73-2.73l-.15-.1a2 2 0 0 1-1-1.72v-.51a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V4a2 2 0 0 0-2-2z"></path>
                            <circle cx="12" cy="12" r="3"></circle>
                        </svg>
                    </div>
                    <div>
                        <h3 className="text-2xl font-bold text-slate-900 dark:text-white tracking-tight">General</h3>
                        <p className="text-sm text-slate-500 dark:text-slate-400 font-medium mt-1">System preferences & connectivity.</p>
                    </div>
                </div>
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
                            description="Required for OpenRouter models. Check your OpenRouter dashboard."
                        />
                    </div>
                )}
                
                {provider === 'ollama' && (
                     <div className="space-y-6 pt-2 animate-in fade-in slide-in-from-top-2 duration-300 w-full">
                        <OllamaHostForm 
                            value={ollamaHost || 'http://localhost:11434'}
                            onSave={onSaveOllamaHost || (async () => {})}
                        />
                        
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
                            autoComplete="off"
                            autoCapitalize="off"
                            autoCorrect="off"
                            spellCheck="false"
                            onBlur={(e) => onSaveServerUrl(e.target.value)}
                            className={isCustomUrl ? 'border-amber-400 bg-amber-50 dark:bg-amber-900/10' : ''}
                        />
                        {isCustomUrl && (
                             <Button
                                onClick={resetApiBaseUrl}
                                variant="outline"
                                className="shrink-0 text-red-600 hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-900/20"
                                title="Reset to Default"
                             >
                                <RotateCcw className="w-4 h-4" />
                             </Button>
                        )}
                     </div>
                     <p className="text-[11px] text-slate-500 px-1">Override the default backend URL (e.g., for testing). Leave empty for default.</p>
                     {isCustomUrl && (
                         <p className="text-[11px] text-amber-600 dark:text-amber-400 px-1 font-medium">⚠️ Using custom backend server. API Keys must be configured for this specific server.</p>
                     )}
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
