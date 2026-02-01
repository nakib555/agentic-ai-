
/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect, useState, useRef } from 'react';
import ReactECharts from 'echarts-for-react';

export type ChartEngine = 'echarts' | 'html';

type UniversalChartProps = {
    content?: string; // Legacy support for markdown parsing or raw code
    engine?: string;
    code?: string; // Raw content from XML tag
};

interface EChartsConfig {
    option: any;
    height?: number;
}

const stripMarkdown = (code: string): string => {
    let clean = code.trim();
    // Remove wrapping ```language ... ``` blocks
    // Check for start with ```
    if (clean.startsWith('```')) {
        // Remove first line (```json etc) and last line (```)
        clean = clean.replace(/^```[a-zA-Z0-9]*\s*/, '').replace(/\s*```$/, '').trim();
    }
    return clean;
};

// Helper to find the JSON/JS Object substring within a larger string
const extractJsonCandidate = (str: string): string => {
    const firstBrace = str.indexOf('{');
    const firstBracket = str.indexOf('[');
    
    let start = -1;
    if (firstBrace !== -1 && firstBracket !== -1) {
        start = Math.min(firstBrace, firstBracket);
    } else if (firstBrace !== -1) {
        start = firstBrace;
    } else {
        start = firstBracket;
    }

    if (start === -1) return str;

    const lastBrace = str.lastIndexOf('}');
    const lastBracket = str.lastIndexOf(']');
    const end = Math.max(lastBrace, lastBracket);

    if (end === -1 || end < start) return str;

    return str.substring(start, end + 1);
};

// Robust parser that handles trailing commas, comments, and unquoted keys
const looseJsonParse = (str: string) => {
    // 1. Try standard JSON parse on original string first
    try {
        return JSON.parse(str);
    } catch (e) { /* continue */ }
    
    // 2. Extract potential JSON part (removes "Here is the data:" prefixes)
    const candidate = extractJsonCandidate(str);
    
    // 3. Pre-process for JS Eval to fix common LLM JSON errors
    let jsFriendly = candidate
        // Replace Python booleans/None if they look like values
        .replace(/:\s*True\b/g, ': true')
        .replace(/:\s*False\b/g, ': false')
        .replace(/:\s*None\b/g, ': null')
        // Fix double commas which cause syntax errors in JS objects (e.g. [1,,2] is sparse, but ,, in obj is bad)
        .replace(/,,\s*/g, ',')
        // Fix: Remove keys that are missing values before a comma, closing brace, or closing bracket
        // e.g. "data":, OR "borderRadius": } OR "items": ]
        .replace(/"[\w\d_]+"\s*:\s*(?=[,}\]])/g, '')
        // Fix: Remove trailing commas before closing braces or brackets (e.g. , } or , ])
        .replace(/,\s*([\]}])/g, '$1');

    // 4. Try JS Eval on candidate (Handles trailing commas, unquoted keys, comments natively in JS)
    try {
         // eslint-disable-next-line no-new-func
         return new Function(`return ${jsFriendly}`)();
    } catch (evalErr) {
        // 5. If JS Eval failed, it might be due to security or strict syntax issues.
        // We throw here, but the calling effect catches it to set the error state.
        throw evalErr;
    }
};

export const UniversalChart: React.FC<UniversalChartProps> = React.memo(({ content, code }) => {
    const [config, setConfig] = useState<EChartsConfig | null>(null);
    const [htmlContent, setHtmlContent] = useState<string | null>(null);
    const [activeEngine, setActiveEngine] = useState<ChartEngine>('echarts');
    const [error, setError] = useState<string | null>(null);
    const [isFullscreen, setIsFullscreen] = useState(false);
    const containerRef = useRef<HTMLDivElement>(null);
    
    // Theme state
    const [isDark, setIsDark] = useState(() => {
        if (typeof document !== 'undefined') {
            return document.documentElement.classList.contains('dark');
        }
        return false;
    });

    // Listen for theme changes
    useEffect(() => {
        const observer = new MutationObserver((mutations) => {
            mutations.forEach((mutation) => {
                if (mutation.attributeName === 'class') {
                    setIsDark(document.documentElement.classList.contains('dark'));
                }
            });
        });
        observer.observe(document.documentElement, { attributes: true });
        return () => observer.disconnect();
    }, []);

    // Effect to parse configuration
    useEffect(() => {
        try {
            const rawContent = code || content;
            if (rawContent) {
                const trimmedCode = stripMarkdown(rawContent);

                // Inject a base style reset to ensure the iframe looks clean by default
                const baseResetStyle = `
                    <style>
                        body { margin: 0; padding: 0; font-family: 'Inter', system-ui, sans-serif; box-sizing: border-box; background: transparent; }
                        *, *:before, *:after { box-sizing: inherit; }
                        ::-webkit-scrollbar { width: 8px; height: 8px; }
                        ::-webkit-scrollbar-thumb { background: #cbd5e1; border-radius: 4px; }
                        ::-webkit-scrollbar-track { background: transparent; }
                    </style>
                `;

                // Heuristic: If it looks like HTML (starts with <), treat as HTML directly
                if (trimmedCode.trim().startsWith('<')) {
                     setActiveEngine('html');
                     // Append reset style to head if head exists, otherwise prepend to content
                     const cleanHtml = trimmedCode.includes('<head>') 
                        ? trimmedCode.replace('<head>', `<head>${baseResetStyle}`)
                        : `${baseResetStyle}${trimmedCode}`;

                     setHtmlContent(cleanHtml);
                     setError(null);
                     return;
                }
                
                // Parse the JSON option object
                const parsed = looseJsonParse(trimmedCode);
                
                if (parsed && typeof parsed === 'object') {
                    // Check if explicit engine is defined
                    if (parsed.engine === 'html' || parsed.type === 'html') {
                        setActiveEngine('html');
                        
                        let combinedContent = parsed.code || parsed.html || '';
                        
                        // Inject separated CSS if provided
                        if (parsed.css) {
                            combinedContent = `<style>${parsed.css}</style>\n${combinedContent}`;
                        }
                        
                        // Inject separated JS if provided
                        if (parsed.javascript || parsed.js) {
                            combinedContent = `${combinedContent}\n<script>${parsed.javascript || parsed.js}</script>`;
                        }

                        // Apply base reset
                        setHtmlContent(`${baseResetStyle}${combinedContent}`);
                    } else {
                        // Default to ECharts
                        setActiveEngine('echarts');
                        setConfig({ option: parsed });
                    }
                    setError(null);
                } else {
                    throw new Error("Parsed content is not a valid object");
                }
            } 
        } catch (e: any) {
            // Only log actual errors to console if they persist, otherwise just update UI state.
            // We suppress console spam for partial JSON during streaming.
            const isSyntaxError = e instanceof SyntaxError;
            if (!isSyntaxError) {
                console.warn("Chart parsing warning:", e.message);
            }
            setError(`Rendering...`); 
        }
    }, [content, code]);

    const toggleFullscreen = () => {
        if (!containerRef.current) return;
        if (!document.fullscreenElement) {
            containerRef.current.requestFullscreen().then(() => setIsFullscreen(true)).catch(err => {
                console.error(`Error enabling fullscreen: ${err.message}`);
            });
        } else {
            document.exitFullscreen().then(() => setIsFullscreen(false));
        }
    };
    
    // Listen for fullscreen change events to update state if exited via Esc key
    useEffect(() => {
        const handleFSChange = () => setIsFullscreen(!!document.fullscreenElement);
        document.addEventListener('fullscreenchange', handleFSChange);
        return () => document.removeEventListener('fullscreenchange', handleFSChange);
    }, []);

    if (error) {
        return (
            <div className="my-6 p-4 border border-gray-200 dark:border-white/10 bg-gray-50 dark:bg-white/5 rounded-xl text-sm flex items-center gap-3">
                 <div className="animate-spin w-4 h-4 border-2 border-indigo-500 border-t-transparent rounded-full"></div>
                 <span className="text-slate-500 dark:text-slate-400 font-medium">{error}</span>
            </div>
        );
    }

    if (activeEngine === 'html') {
        if (!htmlContent) return <div className="h-64 bg-gray-100 dark:bg-white/5 rounded-lg animate-pulse my-6" />;
        return (
            <div 
                ref={containerRef}
                className={`
                    my-6 border border-gray-200 dark:border-white/10 rounded-2xl overflow-hidden bg-white dark:bg-[#121212] shadow-sm relative z-0 group transition-all duration-300
                    ${isFullscreen ? 'bg-white dark:bg-black p-0 border-0 rounded-none' : ''}
                `}
            >
                <div className={`px-4 py-2 border-b border-gray-100 dark:border-white/5 flex justify-between items-center bg-slate-50/50 dark:bg-white/5 backdrop-blur-sm ${isFullscreen ? 'hidden' : ''}`}>
                    <div className="flex items-center gap-2">
                        <span className="w-2 h-2 rounded-full bg-pink-500 shadow-[0_0_8px_rgba(236,72,153,0.6)]"></span>
                        <span className="text-[10px] font-bold uppercase tracking-widest text-slate-500 dark:text-slate-400">
                            HTML Visualization
                        </span>
                    </div>
                    <button 
                        onClick={toggleFullscreen}
                        className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-200/50 dark:hover:bg-white/10 transition-colors"
                        title="Fullscreen"
                    >
                         <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4"><path d="M13.28 7.78l3.22-3.22v2.69a.75.75 0 0 0 1.5 0v-4.5a.75.75 0 0 0-.75-.75h-4.5a.75.75 0 0 0 0 1.5h2.69l-3.22 3.22a.75.75 0 0 0 1.06 1.06zM2 17.25v-4.5a.75.75 0 0 1 1.5 0v2.69l3.22-3.22a.75.75 0 1 1 1.06 1.06l-3.22 3.22h2.69a.75.75 0 0 1 0 1.5h-4.5a.75.75 0 0 1-.75-.75z"/></svg>
                    </button>
                </div>
                
                {/* Iframe Container */}
                <div className={`w-full bg-white dark:bg-[#121212] overflow-hidden ${isFullscreen ? 'h-screen' : 'h-[500px]'}`}>
                     <iframe 
                        srcDoc={htmlContent}
                        className="w-full h-full border-none"
                        sandbox="allow-scripts allow-forms allow-popups allow-same-origin allow-modals" 
                        title="Custom Chart"
                    />
                </div>
            </div>
        );
    }

    // Default ECharts Render
    if (!config) {
        return <div className="h-64 bg-gray-100 dark:bg-white/5 rounded-lg animate-pulse my-6" />;
    }

    return (
        <div className="my-6 w-full rounded-xl overflow-hidden relative z-0">
            {/* Chart Canvas - Full Control */}
            {/* We removed external borders/headers to allow the chart config to control the entire visual area including background */}
            <div className="w-full h-full">
                <ReactECharts
                    option={config.option}
                    // Only apply 'dark' theme if no explicit backgroundColor is set in the options
                    theme={isDark && !config.option.backgroundColor ? 'dark' : undefined}
                    style={{ height: config.height || 400, width: '100%' }}
                    opts={{ renderer: 'svg' }}
                />
            </div>
        </div>
    );
});
