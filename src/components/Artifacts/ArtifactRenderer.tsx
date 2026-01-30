/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useMemo, Suspense } from 'react';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { useSyntaxTheme } from '../../hooks/useSyntaxTheme';
import { ErrorBoundary } from '../ErrorBoundary';
import { DataTable } from './DataTable';

// Lazy load the LiveCodes component
const LiveCodesEmbed = React.lazy(() => import('./SandpackComponent'));

type ArtifactRendererProps = {
    type: 'code' | 'data';
    content: string;
    language?: string;
    title?: string;
};

// Icons
const RefreshIcon = () => (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-3.5 h-3.5">
        <path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"></path>
        <path d="M3 3v5h5"></path>
    </svg>
);

export const ArtifactRenderer: React.FC<ArtifactRendererProps> = ({ type, content, language = 'html', title }) => {
    const [activeTab, setActiveTab] = useState<'preview' | 'source'>('preview');
    const [refreshKey, setRefreshKey] = useState(0);
    const syntaxStyle = useSyntaxTheme();
    
    // Theme detection with lazy initializer to avoid initial flash
    const [isDark, setIsDark] = useState(() => {
        if (typeof document !== 'undefined') {
            return document.documentElement.classList.contains('dark');
        }
        return false;
    });

    useEffect(() => {
        const checkDark = () => setIsDark(document.documentElement.classList.contains('dark'));
        // Initial check in case it changed between state init and effect
        checkDark();
        
        const observer = new MutationObserver(checkDark);
        observer.observe(document.documentElement, { attributes: true, attributeFilter: ['class'] });
        return () => observer.disconnect();
    }, []);

    // Determines if we can render this language visually
    const isRenderable = useMemo(() => {
        if (type === 'data') return true; // Data is always renderable via Table
        const l = (language || '').toLowerCase();
        return ['html', 'svg', 'javascript', 'js', 'jsx', 'ts', 'tsx', 'css', 'react', 'vue', 'svelte', 'python'].includes(l);
    }, [type, language]);

    // Auto-switch tab based on language on mount
    useEffect(() => {
        if (content.length < 50000 && isRenderable) {
            setActiveTab('preview');
        } else {
            setActiveTab('source');
        }
    }, [language, content.length, isRenderable]);

    const handleRefresh = () => {
        setRefreshKey(prev => prev + 1);
    };

    const renderPreview = () => {
        if (type === 'data') {
            try {
                const isJson = content.trim().startsWith('{') || content.trim().startsWith('[');
                let data = isJson ? JSON.parse(content) : null;
                
                // If simple array of objects, render DataTable
                if (Array.isArray(data) && data.length > 0 && typeof data[0] === 'object') {
                   return <DataTable data={data} />;
                }
                return <pre className="p-4 text-xs font-mono">{JSON.stringify(data, null, 2)}</pre>;
            } catch (e) {
                return <div className="p-4 text-red-500">Failed to parse data artifact.</div>;
            }
        }

        return (
            <div className="h-[550px] w-full bg-white dark:bg-[#1e1e1e] border-t border-border-subtle relative">
                 <ErrorBoundary fallback={
                     <div className="absolute inset-0 flex flex-col items-center justify-center bg-white dark:bg-[#1e1e1e] text-center p-4">
                         <div className="text-red-500 mb-2">⚠ Preview Unavailable</div>
                         <p className="text-xs text-slate-500">The interactive environment could not be loaded.</p>
                     </div>
                 }>
                     <Suspense fallback={
                        <div className="absolute inset-0 flex flex-col items-center justify-center bg-white dark:bg-[#1e1e1e]">
                            <div className="w-8 h-8 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin mb-2"></div>
                            <span className="text-xs font-medium text-slate-500">Starting LiveCodes...</span>
                        </div>
                     }>
                         <LiveCodesEmbed
                            key={refreshKey}
                            code={content}
                            language={language}
                            theme={isDark ? "dark" : "light"}
                         />
                    </Suspense>
                </ErrorBoundary>
            </div>
        );
    };

    const highlightLang = (language === 'html' || language === 'svg' || language === 'xml') ? 'markup' : (language || 'text');

    return (
        <div className="my-4 rounded-xl overflow-hidden border border-border-default shadow-lg bg-code-surface transition-colors duration-300">
            <div className="flex items-center justify-between px-4 py-2 bg-layer-2/50 border-b border-border-default backdrop-blur-sm">
                <span className="text-xs font-bold uppercase tracking-wider text-content-secondary">
                    {title || (type === 'code' ? 'Code Snippet' : 'Data View')}
                </span>
                <div className="flex items-center gap-2">
                    {isRenderable && activeTab === 'preview' && type !== 'data' && (
                         <button 
                            onClick={handleRefresh}
                            className="p-1.5 rounded-md text-gray-500 dark:text-gray-400 hover:text-indigo-500 hover:bg-gray-200 dark:hover:bg-white/10 transition-colors"
                            title="Reload Preview"
                        >
                            <RefreshIcon />
                        </button>
                    )}
                    <div className="flex bg-layer-3 p-0.5 rounded-lg">
                        {isRenderable && (
                            <button 
                                onClick={() => setActiveTab('preview')}
                                className={`px-3 py-1 text-xs font-medium rounded-md transition-colors ${activeTab === 'preview' ? 'bg-white dark:bg-gray-700 text-indigo-600 dark:text-indigo-300 shadow-sm' : 'text-gray-500 dark:text-gray-400'}`}
                            >
                                Preview
                            </button>
                        )}
                        <button 
                            onClick={() => setActiveTab('source')}
                            className={`px-3 py-1 text-xs font-medium rounded-md transition-colors ${activeTab === 'source' ? 'bg-white dark:bg-gray-700 text-indigo-600 dark:text-indigo-300 shadow-sm' : 'text-gray-500 dark:text-gray-400'}`}
                        >
                            Source
                        </button>
                    </div>
                </div>
            </div>

            <div className="relative">
                {activeTab === 'preview' ? (
                    renderPreview()
                ) : (
                    <div className="max-h-[400px] overflow-auto custom-scrollbar">
                        <SyntaxHighlighter
                            language={highlightLang}
                            style={syntaxStyle}
                            customStyle={{ 
                                margin: 0, 
                                padding: '1rem', 
                                fontSize: '13px', 
                                lineHeight: '1.5',
                                background: 'transparent',
                            }}
                            codeTagProps={{
                                style: { fontFamily: "'Fira Code', monospace" }
                            }}
                            showLineNumbers
                        >
                            {content}
                        </SyntaxHighlighter>
                    </div>
                )}
            </div>
        </div>
    );
};
