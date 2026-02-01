
/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect, useState, useRef, useMemo } from 'react';
import ReactECharts from 'echarts-for-react';

export type ChartEngine = 'echarts' | 'html';

type UniversalChartProps = {
    content?: string; // Legacy support for markdown parsing or raw code
    engine?: string;
    code?: string; // Raw content from XML tag
    onFixCode?: (code: string) => Promise<string | undefined>;
};

interface EChartsConfig {
    option: any;
    height?: number | string;
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

/**
 * Enforces responsive layouts on ECharts options.
 * This injects "safety" properties to prevent overlap on small screens.
 */
const enforceResponsiveConfig = (option: any, isDark: boolean) => {
    if (!option) return option;
    
    const responsiveOption = { ...option };

    // 1. Enforce Grid Containment
    // This ensures labels (axis text) are calculated as part of the chart size, preventing crop.
    responsiveOption.grid = {
        containLabel: true,
        left: 0,  // Maximize width by removing arbitrary padding
        right: 10, // Small buffer for max values
        bottom: 0,
        top: option.title ? 50 : 30, // Adjust top based on title presence
        ...option.grid 
    };
    
    // CRITICAL FIX: Remove fixed width/height from grid if present to prevent shrinking
    if (responsiveOption.grid) {
        delete responsiveOption.grid.width;
        delete responsiveOption.grid.height;
        // Force containLabel to be true regardless of override
        responsiveOption.grid.containLabel = true;
    }

    // 2. Confine Tooltips
    // Prevents tooltips from causing horizontal scrollbars or getting cut off
    responsiveOption.tooltip = {
        confine: true,
        appendToBody: true, // Use portal to ensure z-index correctness
        trigger: 'axis',
        backgroundColor: isDark ? 'rgba(24, 24, 27, 0.9)' : 'rgba(255, 255, 255, 0.9)',
        borderColor: isDark ? '#3f3f46' : '#e2e8f0',
        textStyle: { color: isDark ? '#f4f4f5' : '#1e293b' },
        padding: [10, 15],
        extraCssText: 'box-shadow: 0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -2px rgba(0, 0, 0, 0.05); border-radius: 8px; backdrop-filter: blur(8px);',
        ...option.tooltip
    };

    // 3. Fix Axis Overlap
    const fixAxis = (axis: any): any => {
        if (!axis) return axis;
        // If array of axes
        if (Array.isArray(axis)) return axis.map(fixAxis);
        
        return {
            ...axis,
            nameLocation: 'middle',
            nameGap: 30, // Move title away from numbers
            axisLabel: {
                hideOverlap: true, // Hide labels if they crash into each other
                interval: 'auto',
                overflow: 'truncate', // Truncate very long labels
                width: 80, // Max width for labels on mobile
                color: isDark ? '#a1a1aa' : '#64748b',
                ...axis.axisLabel
            },
            splitLine: {
                lineStyle: {
                    color: isDark ? 'rgba(255, 255, 255, 0.05)' : 'rgba(0, 0, 0, 0.05)'
                },
                ...axis.splitLine
            },
            axisLine: {
                lineStyle: {
                    color: isDark ? '#52525b' : '#cbd5e1'
                },
                ...axis.axisLine
            }
        };
    };

    if (responsiveOption.xAxis) responsiveOption.xAxis = fixAxis(responsiveOption.xAxis);
    if (responsiveOption.yAxis) responsiveOption.yAxis = fixAxis(responsiveOption.yAxis);

    // 4. Responsive Legend
    if (responsiveOption.legend) {
        responsiveOption.legend = {
            type: 'scroll', // Scrollable legend for small screens
            bottom: 0,
            padding: [5, 10],
            textStyle: { color: isDark ? '#a1a1aa' : '#64748b' },
            ...responsiveOption.legend
        };
        
        // If dataZoom is present, move legend to top or adjust bottom
        if (responsiveOption.dataZoom) {
            responsiveOption.legend.top = option.title ? 25 : 5;
            delete responsiveOption.legend.bottom;
        }
    }
    
    // 5. Adjust for DataZoom
    if (responsiveOption.dataZoom) {
        // Ensure dataZoom doesn't overlap chart content
        responsiveOption.grid.bottom = 40; 
    }

    // 6. Default Background
    if (!responsiveOption.backgroundColor) {
        responsiveOption.backgroundColor = 'transparent';
    }
    
    // 7. Text Styles
    if (option.title) {
        responsiveOption.title = {
            ...option.title,
            textStyle: {
                color: isDark ? '#f4f4f5' : '#1e293b',
                fontWeight: 600,
                fontSize: 14,
                ...option.title.textStyle
            }
        };
    }

    return responsiveOption;
};

export const UniversalChart: React.FC<UniversalChartProps> = React.memo(({ content, code, onFixCode }) => {
    const [config, setConfig] = useState<EChartsConfig | null>(null);
    const [htmlContent, setHtmlContent] = useState<string | null>(null);
    const [activeEngine, setActiveEngine] = useState<ChartEngine>('echarts');
    const [error, setError] = useState<string | null>(null);
    const [isFullscreen, setIsFullscreen] = useState(false);
    const [isFixing, setIsFixing] = useState(false);
    
    // New local state to handle optimistic updates during "Fix Chart"
    const [localCodeOverride, setLocalCodeOverride] = useState<string | null>(null);
    
    const containerRef = useRef<HTMLDivElement>(null);
    const echartsRef = useRef<any>(null); // Ref for ECharts instance
    
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
            // Prefer local override (optimistic fix) over props
            const rawContent = localCodeOverride || code || content;

            if (rawContent) {
                // If we are actively fixing via API, wait. But if we have a localOverride, use it immediately.
                if (isFixing && !localCodeOverride) return;

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
    }, [content, code, isFixing, localCodeOverride]);

    // Apply responsive fixes whenever config or theme changes
    const finalOption = useMemo(() => {
        if (!config?.option) return null;
        return enforceResponsiveConfig(config.option, isDark);
    }, [config, isDark]);

    // Force resize when container changes size or on mount
    useEffect(() => {
        const handleResize = () => {
            if (echartsRef.current) {
                echartsRef.current.getEchartsInstance().resize();
            }
        };

        window.addEventListener('resize', handleResize);
        
        // Also observe container resize for more robustness
        const resizeObserver = new ResizeObserver(() => {
            handleResize();
        });
        
        if (containerRef.current) {
            resizeObserver.observe(containerRef.current);
        }

        return () => {
            window.removeEventListener('resize', handleResize);
            resizeObserver.disconnect();
        };
    }, []);

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

    const handleFix = async () => {
        if (!onFixCode) return;
        
        setIsFixing(true);
        // Clear error momentarily to show loading state more cleanly
        setError('Fixing chart...'); 
        
        try {
            const raw = code || content || '';
            const fixedCode = await onFixCode(raw);
            
            if (fixedCode) {
                // Optimistic update: Render the new code immediately while the parent handles persistence
                setLocalCodeOverride(fixedCode);
                setError(null); 
            } else {
                setError("Fix failed. Please try again.");
            }
        } catch (e) {
            console.error("Chart fix failed:", e);
            setError("Failed to fix chart code.");
        } finally {
            setIsFixing(false);
        }
    };

    if (error) {
        const isRendering = error === 'Rendering...' || error === 'Fixing chart...';
        return (
            <div className="my-4 px-3 py-2 border border-gray-200 dark:border-white/10 bg-gray-50 dark:bg-white/5 rounded-lg text-xs flex items-center justify-between gap-3 w-full animate-in fade-in duration-300">
                 <div className="flex items-center gap-2 overflow-hidden">
                     {isRendering ? (
                         <div className="animate-spin w-3 h-3 border-2 border-indigo-500 border-t-transparent rounded-full flex-shrink-0"></div>
                     ) : (
                         <div className="w-3 h-3 text-red-500 flex-shrink-0">
                             <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
                         </div>
                     )}
                     <span className="text-slate-500 dark:text-slate-400 font-medium truncate">
                        {isRendering ? (isFixing ? "Fixing Graph..." : "Rendering...") : "Chart Error"}
                     </span>
                 </div>
                 
                 {onFixCode && !isFixing && !isRendering && (
                     <button
                        onClick={handleFix}
                        disabled={isFixing}
                        className="px-2 py-1 bg-white dark:bg-white/10 hover:bg-slate-50 dark:hover:bg-white/20 border border-slate-200 dark:border-white/10 rounded font-semibold text-slate-700 dark:text-slate-200 shadow-sm transition-all flex items-center gap-1.5 whitespace-nowrap"
                     >
                        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-3 h-3 text-indigo-500">
                           <path d="m5.433 13.917 1.262-3.155A4 4 0 0 1 7.58 9.42l6.92-6.918a2.121 2.121 0 0 1 3 3l-6.92 6.918c-.383.383-.84.685-1.343.886l-3.154 1.262a.5.5 0 0 1-.65-.65Z" />
                           <path d="M3.5 5.75c0-.69.56-1.25 1.25-1.25H10A.75.75 0 0 0 10 3H4.75A2.75 2.75 0 0 0 2 5.75v9.5A2.75 2.75 0 0 0 4.75 18h9.5A2.75 2.75 0 0 0 17 15.25V10a.75.75 0 0 0-1.5 0v5.25c0 .69-.56 1.25-1.25 1.25h-9.5c-.69 0-1.25-.56-1.25-1.25v-9.5Z" />
                        </svg>
                        Fix
                     </button>
                 )}
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
    if (!finalOption) {
        return <div className="h-64 bg-gray-100 dark:bg-white/5 rounded-lg animate-pulse my-6" />;
    }

    // Use a minimum height of 400px or the model-provided height (parsed from config outside options)
    const chartHeight = config?.height || 450;

    return (
        <div 
            className="my-6 w-full rounded-xl overflow-hidden relative z-0 border border-gray-200 dark:border-white/5 bg-white dark:bg-[#18181b] shadow-sm"
            ref={containerRef}
        >
            {/* Chart Canvas - Full Control */}
            <div className="w-full relative">
                <ReactECharts
                    ref={echartsRef}
                    option={finalOption}
                    theme={isDark && !finalOption.backgroundColor ? 'dark' : undefined}
                    style={{ height: chartHeight, width: '100%', minHeight: '300px' }}
                    opts={{ renderer: 'svg' }}
                />
            </div>
        </div>
    );
});
