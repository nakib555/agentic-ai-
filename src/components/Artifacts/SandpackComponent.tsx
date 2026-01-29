
/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect, useRef, useState } from 'react';

// Define props for the component
type LiveCodesProps = {
    code: string;
    language: string;
    theme: 'dark' | 'light';
    mode?: 'inline' | 'full';
};

// Use UMD build for reliable global injection via script tag
const LIVECODES_CDN = "https://cdn.jsdelivr.net/npm/livecodes/livecodes.umd.js";

// Global promise to track script loading status across multiple instances
let scriptLoadingPromise: Promise<void> | null = null;

const loadLiveCodesScript = () => {
    // If already loaded successfully
    if ((window as any).livecodes) {
        return Promise.resolve();
    }

    if (scriptLoadingPromise) return scriptLoadingPromise;

    scriptLoadingPromise = new Promise((resolve, reject) => {
        const script = document.createElement('script');
        script.src = LIVECODES_CDN;
        script.async = true;
        
        script.onload = () => {
            if ((window as any).livecodes) {
                resolve();
            } else {
                scriptLoadingPromise = null; // Reset on soft failure
                reject(new Error('LiveCodes loaded but global object not found'));
            }
        };

        script.onerror = (e) => {
            console.error("LiveCodes script load error:", e);
            scriptLoadingPromise = null; // Reset to allow retry
            reject(new Error('Failed to load LiveCodes script from CDN'));
        };

        document.head.appendChild(script);
    });

    return scriptLoadingPromise;
};

// Helper to determine LiveCodes configuration based on language
const getLiveCodesConfig = (code: string, lang: string) => {
    const l = lang.toLowerCase();
    
    // Framework detection
    if (l === 'react' || l === 'jsx' || l === 'tsx') {
        return {
            template: 'react',
            script: {
                language: 'tsx',
                content: code
            }
        };
    }
    if (l === 'vue') {
        return {
            template: 'vue',
            script: {
                language: 'vue',
                content: code
            }
        };
    }
    if (l === 'svelte') {
        return {
            template: 'svelte',
            script: {
                language: 'svelte',
                content: code
            }
        };
    }
    if (l === 'python') {
        return {
            template: 'python',
            script: {
                language: 'python',
                content: code
            }
        };
    }
    if (l === 'html') {
        return {
            activeEditor: 'markup',
            markup: {
                language: 'html',
                content: code
            }
        };
    }
    if (l === 'css') {
        return {
            activeEditor: 'style',
            style: {
                language: 'css',
                content: code
            },
            markup: {
                language: 'html',
                content: '<div class="preview-container"><h3>CSS Preview</h3><p>Content styled by the CSS.</p></div>'
            }
        };
    }

    // Default to JavaScript
    return {
        activeEditor: 'script',
        script: {
            language: 'javascript',
            content: code
        }
    };
};

const LiveCodesEmbed: React.FC<LiveCodesProps> = ({ code, language, theme }) => {
    const containerRef = useRef<HTMLDivElement>(null);
    const playgroundRef = useRef<any>(null);
    const [error, setError] = useState<string | null>(null);
    const [isLoading, setIsLoading] = useState(true);

    const init = async () => {
        if (!containerRef.current) return;
        
        // If already initialized, just return
        if (playgroundRef.current) {
            setIsLoading(false);
            return;
        }
        
        setIsLoading(true);
        setError(null);

        try {
            // Ensure script is loaded
            await loadLiveCodesScript();
            
            const livecodesGlobal = (window as any).livecodes;
            if (!livecodesGlobal || !livecodesGlobal.createPlayground) {
                throw new Error("LiveCodes initialization function not found");
            }

            if (!containerRef.current) return; // Unmounted check

            // Clear container before mounting to prevent duplicates
            containerRef.current.innerHTML = '';

            // Initial Configuration
            const config = getLiveCodesConfig(code, language);
            
            // Initialize LiveCodes
            const app = await livecodesGlobal.createPlayground(containerRef.current, {
                config: {
                    ...config,
                    mode: 'result', // Start in result mode
                    theme: theme,   // Initial theme
                    autoupdate: true, // Equivalent to run: true
                    tools: {
                        enabled: ['console'], // Explicitly enable console
                        active: 'console',    // Make console the active tool
                        status: 'closed',     // Show status bar but keep tools closed initially
                    }
                },
            });
            
            playgroundRef.current = app;
            setIsLoading(false);

        } catch (err: any) {
            console.error("LiveCodes initialization failed:", err);
            // Allow user to see error state
            setError(err.message || "Failed to load preview environment.");
            setIsLoading(false);
        }
    };

    // Initialization Effect
    useEffect(() => {
        // Use a timeout to ensure DOM is ready and reduce blocking
        const timer = setTimeout(init, 50);

        return () => {
            clearTimeout(timer);
            if (playgroundRef.current) {
                playgroundRef.current.destroy().catch(() => {});
                playgroundRef.current = null;
            }
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []); 

    // Update Effect
    useEffect(() => {
        const update = async () => {
            if (!playgroundRef.current) return;

            try {
                const config = getLiveCodesConfig(code, language);
                
                await playgroundRef.current.setConfig({
                    ...config,
                    theme: theme,
                    mode: 'result',
                    autoupdate: true,
                    tools: { 
                        enabled: ['console'],
                        active: 'console',
                        status: 'closed'
                    }
                });
            } catch (e) {
                console.warn("Failed to update LiveCodes config", e);
            }
        };

        if (!isLoading && !error) {
            update();
        }
    }, [code, language, theme, isLoading, error]);

    const handleRetry = () => {
        // Reset global promise to force fresh load attempt
        scriptLoadingPromise = null;
        setError(null);
        setIsLoading(true);
        init();
    };

    if (error) {
        return (
            <div className="h-full w-full flex flex-col items-center justify-center bg-gray-50 dark:bg-[#1e1e1e] text-red-500 p-4 text-center border-t border-red-200 dark:border-red-900/30">
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-8 h-8 mb-2 opacity-50"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
                <p className="text-sm font-medium">{error}</p>
                <p className="text-xs text-slate-500 mt-1 max-w-xs">The external editor library failed to load. Check your internet connection.</p>
                <button 
                    onClick={handleRetry}
                    className="mt-4 px-4 py-2 bg-indigo-600 text-white text-xs font-semibold rounded-lg hover:bg-indigo-500 transition-colors"
                >
                    Retry Connection
                </button>
            </div>
        );
    }

    return (
        <div className="relative w-full h-full bg-white dark:bg-[#1e1e1e]">
            {isLoading && (
                <div className="absolute inset-0 flex flex-col items-center justify-center z-10 bg-white dark:bg-[#1e1e1e]">
                    <div className="w-8 h-8 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin mb-3"></div>
                    <span className="text-xs font-medium text-slate-500">Initializing Environment...</span>
                    <span className="text-[10px] text-slate-400 mt-1">This may take a moment</span>
                </div>
            )}
            <div ref={containerRef} style={{ height: '100%', width: '100%', border: 'none' }} />
        </div>
    );
};

export default LiveCodesEmbed;
