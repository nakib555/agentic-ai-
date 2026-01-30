/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect, useState, useCallback } from 'react';
import { motion as motionTyped } from 'framer-motion';
import { SelectDropdown } from '../UI/SelectDropdown';
import { useDebounce } from 'use-debounce';

const motion = motionTyped as any;

type PersonalizeSettingsProps = {
  aboutUser: string;
  setAboutUser: (prompt: string) => void;
  aboutResponse: string;
  setAboutResponse: (prompt: string) => void;
  disabled: boolean;
};

// --- Options Constants ---

const TONE_OPTIONS = [
    { id: 'default', label: 'Default', desc: 'Balanced & Standard' },
    { id: 'professional', label: 'Professional', desc: 'Polished, precise, corporate' },
    { id: 'friendly', label: 'Friendly', desc: 'Warm, chatty, casual' },
    { id: 'candid', label: 'Candid', desc: 'Direct, honest, encouraging' },
    { id: 'quirky', label: 'Quirky', desc: 'Playful, imaginative, fun' },
    { id: 'efficient', label: 'Efficient', desc: 'Concise, plain, robotic' },
    { id: 'nerdy', label: 'Nerdy', desc: 'Technical, enthusiastic, deep' },
    { id: 'cynical', label: 'Cynical', desc: 'Critical, dry, sarcastic' },
];

const INTENSITY_OPTIONS = [
    { id: 'less', label: 'Less' },
    { id: 'default', label: 'Default' },
    { id: 'more', label: 'More' },
];

// --- UI Components ---

const SegmentedControl: React.FC<{
    label: string;
    icon?: React.ReactNode;
    options: { id: string; label: string }[];
    value: string;
    onChange: (val: string) => void;
    disabled?: boolean;
    className?: string;
}> = ({ label, icon, options, value, onChange, disabled, className }) => {
    const id = React.useId();
    
    return (
        <div className={`flex flex-col gap-2 w-full ${className || ''}`}>
            <div className="flex items-center gap-2 px-1">
                {icon && <span className="flex-shrink-0 opacity-70 scale-90">{icon}</span>}
                <span className="text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-widest">{label}</span>
            </div>
            {/* Flattened appearance: removed border and solid background */}
            <div className="flex p-1 bg-slate-100/50 dark:bg-white/5 rounded-lg relative z-0 w-full">
                {options.map((opt) => {
                    const isActive = value === opt.id;
                    return (
                        <button
                            key={opt.id}
                            onClick={() => !disabled && onChange(opt.id)}
                            disabled={disabled}
                            className={`
                                relative flex-1 py-2 text-xs font-medium rounded-md transition-colors duration-200 min-w-0
                                ${isActive 
                                    ? 'text-indigo-600 dark:text-indigo-300' 
                                    : 'text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200'
                                }
                                ${disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}
                            `}
                        >
                            {isActive && (
                                <motion.div
                                    layoutId={`seg-bg-${id}`}
                                    className="absolute inset-0 bg-white dark:bg-[#2a2a2a] rounded-md shadow-sm border border-slate-200/50 dark:border-white/5"
                                    transition={{ type: "spring", bounce: 0.15, duration: 0.3 }}
                                />
                            )}
                            <span className="relative z-10 truncate block px-1">{opt.label}</span>
                        </button>
                    );
                })}
            </div>
        </div>
    );
};

const TextInput: React.FC<{
    label: string;
    placeholder: string;
    value: string;
    onChange: (val: string) => void;
    onBlur?: () => void;
    multiline?: boolean;
    disabled?: boolean;
    icon?: React.ReactNode;
}> = ({ label, placeholder, value, onChange, onBlur, multiline, disabled, icon }) => (
    <div className="flex flex-col gap-2.5 w-full">
        <label className="text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-widest flex items-center gap-2 px-1">
            {icon && <span className="flex-shrink-0 opacity-70 scale-90">{icon}</span>}
            {label}
        </label>
        <div className="relative group w-full">
            {multiline ? (
                <textarea
                    value={value}
                    onChange={e => onChange(e.target.value)}
                    onBlur={onBlur}
                    placeholder={placeholder}
                    disabled={disabled}
                    className="w-full px-4 py-3 bg-transparent border border-slate-200 dark:border-white/10 rounded-xl text-sm text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500/50 focus:border-indigo-500 transition-all placeholder:text-slate-400 dark:placeholder:text-slate-600 min-h-[120px] resize-none leading-relaxed"
                />
            ) : (
                <input
                    type="text"
                    value={value}
                    onChange={e => onChange(e.target.value)}
                    onBlur={onBlur}
                    placeholder={placeholder}
                    disabled={disabled}
                    className="w-full py-2.5 px-4 bg-transparent border border-slate-200 dark:border-white/10 rounded-xl text-sm font-medium text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500/50 focus:border-indigo-500 transition-all placeholder:text-slate-400 dark:placeholder:text-slate-600"
                />
            )}
        </div>
    </div>
);

const SectionHeader: React.FC<{
    title: string;
    subtitle: string;
    icon: React.ReactNode;
    color: string;
    bg: string;
}> = ({ title, subtitle, icon, color, bg }) => (
    <div className="flex items-center gap-4 mb-6">
        <div className={`p-2.5 rounded-xl ${bg} ${color}`}>
            {icon}
        </div>
        <div>
            <h4 className="text-lg font-bold text-slate-800 dark:text-slate-100 tracking-tight leading-none">{title}</h4>
            <p className="text-xs font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider mt-1.5">{subtitle}</p>
        </div>
    </div>
);

const PersonalizeSettings: React.FC<PersonalizeSettingsProps> = ({
    aboutUser, setAboutUser, aboutResponse, setAboutResponse, disabled
}) => {
    // Local state for UI controls
    const [tone, setTone] = useState('default');
    const [warmth, setWarmth] = useState('default');
    const [enthusiasm, setEnthusiasm] = useState('default');
    const [structure, setStructure] = useState('default'); 
    const [emoji, setEmoji] = useState('default');
    
    const [nickname, setNickname] = useState('');
    const [occupation, setOccupation] = useState('');
    const [customInstructions, setCustomInstructions] = useState('');
    const [moreAboutUser, setMoreAboutUser] = useState('');

    const [isLoaded, setIsLoaded] = useState(false);
    const [saveState, setSaveState] = useState<'saved' | 'saving' | 'pending'>('saved');

    // Debounce state only for free-form text inputs to prevent typing lag
    const [debouncedNickname] = useDebounce(nickname, 300);
    const [debouncedOccupation] = useDebounce(occupation, 300);
    const [debouncedMore] = useDebounce(moreAboutUser, 300);
    const [debouncedInstructions] = useDebounce(customInstructions, 300);

    const parseAboutUser = useCallback((text: string) => {
        const nicknameMatch = text.match(/Nickname:\s*([^\n]+)/);
        const occupationMatch = text.match(/Occupation:\s*([^\n]+)/);
        
        let cleanAbout = text
            .replace(/^Nickname:.*$/gm, '')
            .replace(/^Occupation:.*$/gm, '')
            .trim();
        
        setNickname(nicknameMatch ? nicknameMatch[1].trim() : '');
        setOccupation(occupationMatch ? occupationMatch[1].trim() : '');
        setMoreAboutUser(cleanAbout);
    }, []);

    const parseAboutResponse = useCallback((text: string) => {
        // Updated regex to ensure we stop at comma OR newline to avoid swallowing subsequent lines
        const toneMatch = text.match(/Tone:\s*([^\n]+)/);
        const warmthMatch = text.match(/Warmth:\s*([^,\n]+)/);
        const enthMatch = text.match(/Enthusiasm:\s*([^,\n]+)/);
        const structMatch = text.match(/Structure:\s*([^,\n]+)/);
        const emojiMatch = text.match(/Emoji:\s*([^,\n]+)/);
        
        let cleanInstructions = text
            .replace(/^Tone:.*$/gm, '')
            .replace(/^Traits:.*$/gm, '')
            .trim();

        setTone(toneMatch ? toneMatch[1].toLowerCase().trim() : 'default');
        setWarmth(warmthMatch ? warmthMatch[1].toLowerCase().trim() : 'default');
        setEnthusiasm(enthMatch ? enthMatch[1].toLowerCase().trim() : 'default');
        setStructure(structMatch ? structMatch[1].toLowerCase().trim() : 'default');
        setEmoji(emojiMatch ? emojiMatch[1].toLowerCase().trim() : 'default');
        setCustomInstructions(cleanInstructions);
    }, []);

    // --- Parsing Logic (Executed on Mount) ---
    useEffect(() => {
        parseAboutUser(aboutUser);
        parseAboutResponse(aboutResponse);
        setIsLoaded(true);
    }, []); // Run once on mount

    // --- Update Logic ---

    // 1. User Profile Sync
    useEffect(() => {
        if (!isLoaded) return;
        
        const parts = [];
        if (debouncedNickname.trim()) parts.push(`Nickname: ${debouncedNickname.trim()}`);
        if (debouncedOccupation.trim()) parts.push(`Occupation: ${debouncedOccupation.trim()}`);
        if (debouncedMore.trim()) parts.push(debouncedMore.trim());
        
        const finalString = parts.join('\n');
        
        if (finalString !== aboutUser) {
            setSaveState('saving');
            setAboutUser(finalString);
        } else if (saveState === 'saving') {
            const timer = setTimeout(() => setSaveState('saved'), 500);
            return () => clearTimeout(timer);
        }
    }, [debouncedNickname, debouncedOccupation, debouncedMore, isLoaded, aboutUser, saveState, setAboutUser]);

    // 2. Response Style Sync
    useEffect(() => {
        if (!isLoaded) return;
        
        const traits = [];
        if (warmth !== 'default') traits.push(`Warmth: ${warmth}`);
        if (enthusiasm !== 'default') traits.push(`Enthusiasm: ${enthusiasm}`);
        if (structure !== 'default') traits.push(`Structure: ${structure}`);
        if (emoji !== 'default') traits.push(`Emoji: ${emoji}`);

        const parts = [];
        if (tone !== 'default') parts.push(`Tone: ${tone}`);
        if (traits.length > 0) parts.push(`Traits: ${traits.join(', ')}`);
        if (debouncedInstructions.trim()) parts.push(debouncedInstructions.trim());

        const finalString = parts.join('\n');
        
        if (finalString !== aboutResponse) {
            setSaveState('saving');
            setAboutResponse(finalString);
        } else if (saveState === 'saving') {
            const timer = setTimeout(() => setSaveState('saved'), 500);
            return () => clearTimeout(timer);
        }
    }, [debouncedInstructions, tone, warmth, enthusiasm, structure, emoji, isLoaded, aboutResponse, saveState, setAboutResponse]);


    const handleToneChange = (val: string) => setTone(val);
    const handleWarmthChange = (val: string) => setWarmth(val);
    const handleEnthusiasmChange = (val: string) => setEnthusiasm(val);
    const handleStructureChange = (val: string) => setStructure(val);
    const handleEmojiChange = (val: string) => setEmoji(val);

    const handleNicknameChange = (val: string) => { setNickname(val); setSaveState('pending'); };
    const handleOccupationChange = (val: string) => { setOccupation(val); setSaveState('pending'); };
    const handleMoreChange = (val: string) => { setMoreAboutUser(val); setSaveState('pending'); };
    const handleCustomChange = (val: string) => { setCustomInstructions(val); setSaveState('pending'); };

    const handleReset = () => {
        if (confirm("Reset all personalization settings to default? This will clear your custom instructions and profile.")) {
            // Reset local state
            setTone('default');
            setWarmth('default');
            setEnthusiasm('default');
            setStructure('default');
            setEmoji('default');
            setNickname('');
            setOccupation('');
            setCustomInstructions('');
            setMoreAboutUser('');
            
            // Allow useEffects to handle the backend sync naturally
        }
    };

    return (
        <div className="pb-16 w-full">
            {/* Header with Auto-Save Indicator */}
            <div className="mb-12 flex flex-col sm:flex-row sm:items-center justify-between gap-6">
                <div className="flex items-center gap-4">
                    <div className="p-3 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-2xl shadow-lg shadow-indigo-500/20 text-white">
                        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-6 h-6"><path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/><path d="M12 11l4 4"/><path d="M16 11l-4 4"/></svg>
                    </div>
                    <div>
                        <h3 className="text-2xl font-bold text-slate-900 dark:text-white tracking-tight">Personalization</h3>
                        <p className="text-sm text-slate-500 dark:text-slate-400 font-medium mt-1">Customize the AI's personality and your profile.</p>
                    </div>
                </div>

                <div className="flex items-center gap-3 self-end sm:self-auto">
                    <button 
                        onClick={handleReset}
                        className="px-4 py-2 text-xs font-bold uppercase tracking-wide text-slate-500 hover:text-red-500 hover:bg-red-50 dark:text-slate-400 dark:hover:bg-red-900/10 rounded-xl transition-colors border border-transparent hover:border-red-100 dark:hover:border-red-900/20"
                        disabled={disabled}
                    >
                        Reset Defaults
                    </button>
                    
                    <div className="flex items-center gap-2.5 px-4 py-2 bg-white/80 dark:bg-white/5 rounded-xl border border-slate-200 dark:border-white/10 shadow-sm backdrop-blur-sm">
                        {saveState === 'saved' ? (
                            <>
                                <svg className="w-3.5 h-3.5 text-green-500" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
                                    <path fillRule="evenodd" d="M16.704 4.153a.75.75 0 0 1 .143 1.052l-8 10.5a.75.75 0 0 1-1.127.075l-4.5-4.5a.75.75 0 0 1 1.06-1.06l3.894 3.893 7.48-9.817a.75.75 0 0 1 1.05-.143Z" clipRule="evenodd" />
                                </svg>
                                <span className="text-xs font-bold text-slate-600 dark:text-slate-300 uppercase tracking-wider">Saved</span>
                            </>
                        ) : saveState === 'saving' ? (
                            <>
                                <svg className="animate-spin w-3.5 h-3.5 text-indigo-500" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                                </svg>
                                <span className="text-xs font-bold text-indigo-600 dark:text-indigo-400 uppercase tracking-wider">Saving</span>
                            </>
                        ) : (
                            <>
                                <span className="w-2 h-2 rounded-full bg-amber-400 animate-pulse"></span>
                                <span className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Typing</span>
                            </>
                        )}
                    </div>
                </div>
            </div>

            {/* Main Grid */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 xl:gap-16 items-start">
                
                {/* Column 1: Persona Tuning */}
                <div className="flex flex-col w-full">
                    <SectionHeader 
                        title="Style & Tone" 
                        subtitle="AI Personality" 
                        icon={<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-5 h-5"><path d="m12 3-1.912 5.813a2 2 0 0 1-1.275 1.275L3 12l5.813 1.912a2 2 0 0 1 1.275 1.275L12 21l1.912-5.813a2 2 0 0 1 1.275-1.275L21 12l-5.813-1.912a2 2 0 0 1-1.275-1.275L12 3Z"/><path d="M5 3v4"/><path d="M9 5H3"/><path d="M19 19v4"/><path d="M21 21h-4"/></svg>}
                        color="text-fuchsia-600 dark:text-fuchsia-400" 
                        bg="bg-fuchsia-50 dark:bg-fuchsia-500/10" 
                    />

                    <div className="space-y-8 pl-1 w-full">
                        <SelectDropdown 
                            label="Primary Persona" 
                            icon={<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4 text-fuchsia-500"><circle cx="12" cy="8" r="5"/><path d="M20 21a8 8 0 0 0-16 0"/></svg>}
                            value={tone} 
                            onChange={handleToneChange} 
                            options={TONE_OPTIONS} 
                            disabled={disabled}
                            triggerClassName="w-full bg-slate-50/50 dark:bg-white/5 border border-slate-200 dark:border-white/10 rounded-xl px-4 py-3 hover:border-indigo-400 dark:hover:border-indigo-400 transition-colors shadow-sm"
                        />

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 w-full">
                            <SegmentedControl 
                                label="Warmth" 
                                icon={<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4 text-orange-500"><path d="M19 14c1.49-1.28 3.6-1.28 5.09 0 1.49 1.28 1.49 3.36 0 4.63s-3.6 1.28-5.09 0c-1.49-1.28-1.49-3.36 0-4.63z"/><path d="M11.23 8.8c-2.73-1.53-2.92-3.8-2.92-3.8s-3.23 2-1.72 6.8c1.33 4.2 3.64 6.7 9.42 7.2 4.47.38 6.75-2.26 6.75-2.26s-1.57 3.53-7.51 3.26c-5.7-.26-7.82-3.66-9.15-7.87C4.7 8.1 7.21 4.7 7.21 4.7s2.21 2.37 4.02 4.1z"/></svg>}
                                value={warmth} 
                                onChange={handleWarmthChange} 
                                options={INTENSITY_OPTIONS} 
                                disabled={disabled} 
                            />
                            <SegmentedControl 
                                label="Enthusiasm" 
                                icon={<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4 text-yellow-500"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/></svg>}
                                value={enthusiasm} 
                                onChange={handleEnthusiasmChange} 
                                options={INTENSITY_OPTIONS} 
                                disabled={disabled} 
                            />
                            <SegmentedControl 
                                label="Formatting" 
                                icon={<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4 text-blue-500"><line x1="21" y1="10" x2="3" y2="10"/><line x1="21" y1="6" x2="3" y2="6"/><line x1="21" y1="14" x2="3" y2="14"/><line x1="21" y1="18" x2="3" y2="18"/></svg>}
                                value={structure} 
                                onChange={handleStructureChange} 
                                options={INTENSITY_OPTIONS} 
                                disabled={disabled}
                            />
                            <SegmentedControl 
                                label="Emoji Usage" 
                                icon={<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4 text-teal-500"><circle cx="12" cy="12" r="10"/><path d="M8 14s1.5 2 4 2 4-2 4-2"/><line x1="9" y1="9" x2="9.01" y2="9"/><line x1="15" y1="9" x2="15.01" y2="9"/></svg>}
                                value={emoji} 
                                onChange={handleEmojiChange} 
                                options={INTENSITY_OPTIONS} 
                                disabled={disabled}
                            />
                        </div>

                        <TextInput 
                            label="Custom System Instructions" 
                            value={customInstructions} 
                            onChange={handleCustomChange} 
                            placeholder="Enter specific behavioral rules or response formatting instructions..."
                            multiline
                            disabled={disabled}
                            icon={<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4 text-purple-500"><path d="M12 20h9"/><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"/></svg>}
                        />
                    </div>
                </div>

                {/* Column 2: User Context */}
                <div className="flex flex-col w-full">
                    <SectionHeader 
                        title="User Profile" 
                        subtitle="Your Context" 
                        icon={<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-5 h-5"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>}
                        color="text-cyan-600 dark:text-cyan-400" 
                        bg="bg-cyan-50 dark:bg-cyan-500/10" 
                    />

                    <div className="space-y-8 pl-1 w-full">
                        <TextInput 
                            label="Nickname" 
                            value={nickname} 
                            onChange={handleNicknameChange} 
                            placeholder="How should I address you?"
                            disabled={disabled}
                            icon={<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4 text-cyan-500"><path d="M15 14c.2-1 .7-1.7 1.5-2.5 1-.9 1.5-2.2 1.5-3.5A6 6 0 0 0 6 8c0 1 .2 2.2 1.5 3.5.7.7 1.3 1.5 1.5 2.5"/><path d="M9 18h6"/><path d="M10 22h4"/></svg>}
                        />

                        <TextInput 
                            label="Occupation / Role" 
                            value={occupation} 
                            onChange={handleOccupationChange} 
                            placeholder="Work context (e.g. Student, Engineer)"
                            disabled={disabled}
                            icon={<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4 text-emerald-500"><rect width="20" height="14" x="2" y="7" rx="2" ry="2"/><path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16"/></svg>}
                        />

                        <TextInput 
                            label="Additional Context" 
                            value={moreAboutUser} 
                            onChange={handleMoreChange} 
                            placeholder="Enter details about yourself or your work context that I should always know..."
                            multiline
                            disabled={disabled}
                            icon={<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4 text-rose-500"><path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/><line x1="10" y1="9" x2="8" y2="9"/></svg>}
                        />
                    </div>
                </div>
            </div>
        </div>
    );
};

export default PersonalizeSettings;