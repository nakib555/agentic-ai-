/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useMemo, Suspense } from 'react';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { Tooltip } from '../UI/Tooltip';
import { useSyntaxTheme } from '../../hooks/useSyntaxTheme';
import { ErrorBoundary } from '../ErrorBoundary';

// Lazy load the shared component
const LiveCodesEmbed = React.lazy(() => import('../Artifacts/SandpackComponent'));

// --- Icons ---
const CopyIcon = () => (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4">
        <rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect>
        <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path>
    </svg>
);

const CheckIcon = () => (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4 text-green-500">
        <polyline points="20 6 9 17 4 12"></polyline>
    </svg>
);

const CodeIcon = () => (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4">
        <polyline points="16 18 22 12 16 6"></polyline>
        <polyline points="8 6 2 12 8 18"></polyline>
    </svg>
);

const EyeIcon = () => (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4">
        <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path>
        <circle cx="12" cy="12" r="3"></circle>
    </svg>
);

const RefreshIcon = () => (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4">
        <path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"></path>
        <path d="M3 3v5h5"></path>
    </svg>
);

type ArtifactContentProps = {
    content: string;
    language: string;
    onClose: () => void;
};

export const ArtifactContent: React.FC<ArtifactContentProps> = React.memo(({ content, language, onClose }) => {
    const syntaxStyle = useSyntaxTheme();
    const [activeTab, setActiveTab] = useState<'code' | 'preview'>('code');
    const [isCopied, setIsCopied] = React.useState(false);
    const [refreshKey, setRefreshKey] = useState(0);
    
    // Theme detection
    const [isDark, setIsDark] = useState(false);
    useEffect(() => {
        const checkDark = () => setIsDark(document.documentElement.classList.contains('dark'));
        checkDark();
        const observer = new MutationObserver(checkDark);
        observer.observe(document.documentElement, { attributes: true, attributeFilter: ['class'] });
        return () => observer.disconnect();
    }, []);

    const isPreviewable = useMemo(() => {
        const l = (language || '').toLowerCase();
        return ['html', 'svg', 'javascript', 'js', 'jsx', 'ts', 'tsx', 'css', 'react', 'vue', 'svelte', 'python'].includes(l);
    }, [language]);

    // Auto-switch tab based on language detection
    // Note: This only runs when props change, so manual tab switching is preserved during simple re-renders
    useEffect(() => {
        if (content.length < 50000 && isPreviewable) {
            setActiveTab('preview');
        } else {
            setActiveTab('code');
        }
    }, [language, content.length, isPreviewable]);

    const handleCopy = () => {
        navigator.clipboard.writeText(content);
        setIsCopied(true);
        setTimeout(() => setIsCopied(false), 2000);
    };

    const handleRefresh = () => {
        setRefreshKey(prev => prev + 1);
    };

    const displayLanguage = useMemo(() => {
        if (!language) return 'TXT';
        return language.toUpperCase();
    }, [language]);

    return (
        <div className="flex flex-col h-full overflow-hidden w-full bg-layer-1">
            {/* Header Toolbar */}
            <div className="flex flex-wrap items-center justify-between gap-y-2 px-4 py-3 bg-layer-1 border-b border-border-subtle flex-shrink-0 w-full">
                <div className="flex items-center gap-3 overflow-x-auto no-scrollbar max-w-full">
                    <div className="flex items-center gap-2 px-2 py-1 bg-layer-2 rounded-md border border-border-default flex-shrink-0">
                        <span className="text-xs font-bold text-content-secondary uppercase tracking-wider font-mono">
                            {displayLanguage}
                        </span>
                    </div>
                    {isPreviewable && (
                        <div className="flex bg-layer-2 p-0.5 rounded-lg border border-border-default flex-shrink-0">
                            <button 
                                onClick={() => setActiveTab('code')}
                                className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-md transition-all ${
                                    activeTab === 'code' 
                                    ? 'bg-white dark:bg-[#2a2a2a] text-indigo-600 dark:text-indigo-400 shadow-sm ring-1 ring-black/5 dark:ring-white/10' 
                                    : 'text-content-secondary hover:text-content-primary'
                                }`}
                            >
                                <CodeIcon />
                                Code
                            </button>
                            <button 
                                onClick={() => setActiveTab('preview')}
                                className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-md transition-all ${
                                    activeTab === 'preview' 
                                    ? 'bg-white dark:bg-[#2a2a2a] text-indigo-600 dark:text-indigo-400 shadow-sm ring-1 ring-black/5 dark:ring-white/10' 
                                    : 'text-content-secondary hover:text-content-primary'
                                }`}
                            >
                                <EyeIcon />
                                Preview
                            </button>
                        </div>
                    )}
                </div>
                
                <div className="flex items-center gap-2 ml-auto">
                    {activeTab === 'preview' && (
                         <Tooltip content="Reload Preview" position="bottom" delay={500}>
                            <button 
                                onClick={handleRefresh}
                                className="p-2 rounded-lg text-content-secondary hover:text-indigo-500 hover:bg-layer-2 transition-colors"
                                aria-label="Reload preview"
                            >
                                <RefreshIcon />
                            </button>
                        </Tooltip>
                    )}

                    <Tooltip content="Copy Code" position="bottom" delay={500}>
                        <button 
                            onClick={handleCopy}
                            className="p-2 rounded-lg text-content-secondary hover:text-content-primary hover:bg-layer-2 transition-colors"
                            aria-label="Copy code"
                        >
                            {isCopied ? <CheckIcon /> : <CopyIcon />}
                        </button>
                    </Tooltip>
                    
                    <Tooltip content="Close Panel" position="bottom" delay={500}>
                        <button 
                            onClick={onClose} 
                            className="p-2 rounded-lg text-content-secondary hover:text-content-primary hover:bg-layer-2 transition-colors"
                            aria-label="Close artifact"
                        >
                            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-5 h-5">
                                <line x1="18" y1="6" x2="6" y2="18"></line>
                                <line x1="6" y1="6" x2="18" y2="18"></line>
                            </svg>
                        </button>
                    </Tooltip>
                </div>
            </div>

            {/* Main Content Area */}
            {/* We use 'hidden' class to toggle visibility instead of unmounting to preserve state (LiveCodes edits) */}
            <div className="flex-1 min-h-0 relative overflow-hidden flex flex-col w-full">
                {/* CODE VIEW */}
                <div className={`flex-1 relative overflow-auto custom-scrollbar bg-code-surface ${activeTab === 'code' ? 'flex' : 'hidden'}`}>
                    <div className="w-full min-h-full">
                        <SyntaxHighlighter
                            language={language}
                            style={syntaxStyle}
                            customStyle={{ 
                                margin: 0, 
                                padding: '1.5rem', 
                                minHeight: '100%', 
                                fontSize: '13px', 
                                lineHeight: '1.5',
                                fontFamily: "'Fira Code', monospace",
                                background: 'transparent',
                            }}
                            showLineNumbers={true}
                            wrapLines={false} 
                            lineNumberStyle={{ minWidth: '3em', paddingRight: '1em', opacity: 0.3 }}
                            fallbackLanguage="text"
                        >
                            {content || ''}
                        </SyntaxHighlighter>
                    </div>
                </div>

                {/* PREVIEW VIEW using LiveCodes */}
                {/* Only render if language supports preview to save resources */}
                {isPreviewable && (
                    <div className={`flex-1 relative flex-col bg-layer-2 ${activeTab === 'preview' ? 'flex' : 'hidden'}`}>
                        <div className="flex-1 w-full h-full relative bg-white dark:bg-[#1e1e1e]">
                             <ErrorBoundary fallback={
                                 <div className="flex flex-col items-center justify-center h-full p-4 text-center bg-white dark:bg-[#1e1e1e]">
                                     <div className="text-red-500 mb-2">⚠ Preview Unavailable</div>
                                     <p className="text-sm">Failed to load LiveCodes environment.</p>
                                     <button onClick={() => setActiveTab('code')} className="mt-4 px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded text-sm transition-colors">
                                         View Code Source
                                     </button>
                                 </div>
                             }>
                                 <Suspense fallback={
                                    <div className="absolute inset-0 flex flex-col items-center justify-center bg-white dark:bg-[#1e1e1e]">
                                        <div className="w-8 h-8 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin mb-2"></div>
                                        <span className="text-xs font-medium text-slate-500">Starting Environment...</span>
                                    </div>
                                 }>
                                     <LiveCodesEmbed
                                        key={refreshKey} // Force remount on refresh
                                        theme={isDark ? "dark" : "light"}
                                        code={content}
                                        language={language}
                                     />
                                </Suspense>
                            </ErrorBoundary>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
});