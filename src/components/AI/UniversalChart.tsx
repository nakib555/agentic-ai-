
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
    isStreaming?: boolean;
};

interface EChartsConfig {
    option: any;
    height?: number | string;
}

const stripMarkdown = (code: string): string => {
    let clean = code.trim();
    // Remove wrapping ```language ... ``` blocks
    if (clean.startsWith('```')) {
        // Remove first line (```json etc) and last line (```)
        clean = clean.replace(/^```[a-zA-Z0-9]*\s*/, '').replace(/\s*```$/, '').trim();
    }
    return clean;
};

// Robust parser that handles trailing commas, comments, and unquoted keys
const looseJsonParse = (str: string) => {
    // 1. Try standard JSON parse on original string first
    try {
        return JSON.parse(str);
    } catch (e) { /* continue */ }
    
    // 2. Extract potential JSON part (removes "Here is the data:" prefixes)
    const firstBrace = str.indexOf('{');
    const lastBrace = str.lastIndexOf('}');
    if (firstBrace === -1 || lastBrace === -1) return str;
    
    const candidate = str.substring(firstBrace, lastBrace + 1);
    
    // 3. Pre-process for JS Eval to fix common LLM JSON errors
    let jsFriendly = candidate
        .replace(/:\s*True\b/g, ': true')
        .replace(/:\s*False\b/g, ': false')
        .replace(/:\s*None\b/g, ': null')
        .replace(/,,\s*/g, ',') // Fix double commas
        .replace(/"[\w\d_]+"\s*:\s*(?=[,}\]])/g, '') // Remove empty keys
        .replace(/,\s*([\]}])/g, '$1'); // Remove trailing commas

    // 4. Try JS Eval on candidate
    try {
         // eslint-disable-next-line no-new-func
         return new Function(`return ${jsFriendly}`)();
    } catch (evalErr) {
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
    // We override AI-generated static margins with fixed percentages/padding.
    // 'containLabel: true' is the magic property that prevents label clipping.
    responsiveOption.grid = {
        ...option.grid,
        containLabel: true,
        left: '2%',
        right: '2%',
        bottom: '5%',
        top: option.title ? 60 : 40, 
        // Force auto dimensions
        width: 'auto',
        height: 'auto'
    };

    // 2. Confine Tooltips to Container
    // Prevents tooltips from causing horizontal scrollbars or getting cut off on mobile.
    responsiveOption.tooltip = {
        confine: true,
        appendToBody: true, // Portal to body to avoid z-index issues
        trigger: 'axis',
        backgroundColor: isDark ? 'rgba(24, 24, 27, 0.9)' : 'rgba(255, 255, 255, 0.9)',
        borderColor: isDark ? '#3f3f46' : '#e2e8f0',
        textStyle: { color: isDark ? '#f4f4f5' : '#1e293b' },
        padding: [10, 15],
        extraCssText: 'box-shadow: 0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -2px rgba(0, 0, 0, 0.05); border-radius: 8px; backdrop-filter: blur(8px);',
        ...option.tooltip
    };

    // 3. Fix Axis Overlap & Labeling
    const fixAxis = (axis: any): any => {
        if (!axis) return axis;
        if (Array.isArray(axis)) return axis.map(fixAxis);
        
        return {
            ...axis,
            nameLocation: 'middle',
            nameGap: 30, 
            axisLabel: {
                hideOverlap: true, // Critical: Hide labels if they crash into each other
                interval: 'auto',
                overflow: 'truncate',
                width: 80, // Limit width on mobile
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
                lineStyle: { color: isDark ? '#52525b' : '#cbd5e1' },
                ...axis.axisLine
            }
        };
    };

    if (responsiveOption.xAxis) responsiveOption.xAxis = fixAxis(responsiveOption.xAxis);
    if (responsiveOption.yAxis) responsiveOption.yAxis = fixAxis(responsiveOption.yAxis);

    // 4. Responsive Legend
    if (responsiveOption.legend) {
        responsiveOption.legend = {
            type: 'scroll', // Scrollable legend is safer for mobile
            bottom: 0,
            padding: [5, 10],
            textStyle: { color: isDark ? '#a1a1aa' : '#64748b' },
            itemGap: 15,
            ...responsiveOption.legend
        };
        
        // Prevent legend from overlapping dataZoom
        if (responsiveOption.dataZoom) {
            responsiveOption.legend.top = option.title ? 25 : 5;
            delete responsiveOption.legend.bottom;
        }
    }
    
    // 5. Adjust for DataZoom
    if (responsiveOption.dataZoom) {
        responsiveOption.grid.bottom = 45; 
    }

    // 6. Default Background
    if (!responsiveOption.backgroundColor) {
        responsiveOption.backgroundColor = 'transparent';
    }
    
    // 7. Title Styles
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

export const UniversalChart: React.FC<UniversalChartProps> = React.memo(({ content, code, onFixCode, isStreaming }) => {
    const [config, setConfig] = useState<EChartsConfig | null>(null);
    const [htmlContent, setHtmlContent] = useState<string | null>(null);
    const [activeEngine, setActiveEngine] = useState<ChartEngine>('echarts');
    const [error, setError] = useState<string | null>(null);
    const [isFullscreen, setIsFullscreen] = useState(false);
    const [isFixing, setIsFixing] = useState(false);
    const [localCodeOverride, setLocalCodeOverride] = useState<string | null>(null);
    
    const containerRef = useRef<HTMLDivElement>(null);
    const echartsRef = useRef<any>(null);
    
    // Theme state
    const [isDark, setIsDark] = useState(() => {
        if (typeof document !== 'undefined') {
            return document.documentElement.classList.contains('dark');
        }
        return false;
    });

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

    // Parse configuration
    useEffect(() => {
        try {
            const rawContent = localCodeOverride || code || content;

            if (rawContent) {
                if (isFixing && !localCodeOverride) return;

                const trimmedCode = stripMarkdown(rawContent);

                const baseResetStyle = `
                    <style>
                        body { margin: 0; padding: 0; font-family: 'Inter', system-ui, sans-serif; box-sizing: border-box; background: transparent; }
                        *, *:before, *:after { box-sizing: inherit; }
                        ::-webkit-scrollbar { width: 8px; height: 8px; }
                        ::-webkit-scrollbar-thumb { background: #cbd5e1; border-radius: 4px; }
                        ::-webkit-scrollbar-track { background: transparent; }
                    </style>
                `;

                if (trimmedCode.trim().startsWith('<')) {
                     setActiveEngine('html');
                     const cleanHtml = trimmedCode.includes('<head>') 
                        ? trimmedCode.replace('<head>', `<head>${baseResetStyle}`)
                        : `${baseResetStyle}${trimmedCode}`;
                     setHtmlContent(cleanHtml);
                     setError(null);
                     return;
                }
                
                const parsed = looseJsonParse(trimmedCode);
                
                if (parsed && typeof parsed === 'object') {
                    if (parsed.engine === 'html' || parsed.type === 'html') {
                        setActiveEngine('html');
                        let combinedContent = parsed.code || parsed.html || '';
                        if (parsed.css) combinedContent = `<style>${parsed.css}</style>\n${combinedContent}`;
                        if (parsed.javascript || parsed.js) combinedContent = `${combinedContent}\n<script>${parsed.javascript || parsed.js}</script>`;
                        setHtmlContent(`${baseResetStyle}${combinedContent}`);
                    } else {
                        setActiveEngine('echarts');
                        setConfig({ option: parsed });
                    }
                    setError(null);
                } else {
                    throw new Error("Parsed content is not a valid object");
                }
            } 
        } catch (e: any) {
            if (isStreaming) {
                 setError(`Rendering...`); 
            } else {
                 console.warn("Chart parsing error (Final):", e.message);
                 setError(e.message || "Invalid Chart Configuration");
            }
        }
    }, [content, code, isFixing, localCodeOverride, isStreaming]);

    // Compute final options with responsive overrides
    const finalOption = useMemo(() => {
        if (!config?.option) return null;
        return enforceResponsiveConfig(config.option, isDark);
    }, [config, isDark]);

    // Force resize on mount and window resize
    useEffect(() => {
        const handleResize = () => {
            if (echartsRef.current) {
                echartsRef.current.getEchartsInstance().resize();
            }
        };
        window.addEventListener('resize', handleResize);
        
        const resizeObserver = new ResizeObserver(() => handleResize());
        if (containerRef.current) resizeObserver.observe(containerRef.current);

        return () => {
            window.removeEventListener('resize', handleResize);
            resizeObserver.disconnect();
        };
    }, []);

    const toggleFullscreen = () => {
        if (!containerRef.current) return;
        if (!document.fullscreenElement) {
            containerRef.current.requestFullscreen().then(() => setIsFullscreen(true)).catch(console.error);
        } else {
            document.exitFullscreen().then(() => setIsFullscreen(false));
        }
    };
    
    useEffect(() => {
        const handleFSChange = () => setIsFullscreen(!!document.fullscreenElement);
        document.addEventListener('fullscreenchange', handleFSChange);
        return () => document.removeEventListener('fullscreenchange', handleFSChange);
    }, []);

    const handleFix = async () => {
        if (!onFixCode) return;
        setIsFixing(true);
        setError('Fixing chart...'); 
        try {
            const raw = code || content || '';
            const fixedCode = await onFixCode(raw);
            if (fixedCode) {
                setLocalCodeOverride(fixedCode);
                setError(null); 
            } else {
                setError("Fix failed. Please try again.");
            }
        } catch (e) {
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

    if (!finalOption) {
        return <div className="h-64 bg-gray-100 dark:bg-white/5 rounded-lg animate-pulse my-6" />;
    }

    const chartHeight = config?.height || 450;

    return (
        <div 
            className="my-6 w-full rounded-xl overflow-hidden relative z-0 border border-gray-200 dark:border-white/5 bg-white dark:bg-[#18181b] shadow-sm"
            ref={containerRef}
        >
            <div className="w-full relative">
                <ReactECharts
                    ref={echartsRef}
                    option={finalOption}
                    theme={isDark && !finalOption.backgroundColor ? 'dark' : undefined}
                    style={{ height: chartHeight, width: '100%', minHeight: '300px' }}
                    opts={{ renderer: 'svg' }}
                />
            </div>
            {/* Overlay for fullscreen button when hovering chart */}
            <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity">
                <button 
                    onClick={toggleFullscreen}
                    className="p-2 bg-white/80 dark:bg-black/50 backdrop-blur rounded-lg text-slate-500 hover:text-indigo-500 shadow-sm"
                    title="Fullscreen"
                >
                     <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4"><path d="M13.28 7.78l3.22-3.22v2.69a.75.75 0 0 0 1.5 0v-4.5a.75.75 0 0 0-.75-.75h-4.5a.75.75 0 0 0 0 1.5h2.69l-3.22 3.22a.75.75 0 0 0 1.06 1.06zM2 17.25v-4.5a.75.75 0 0 1 1.5 0v2.69l3.22-3.22a.75.75 0 1 1 1.06 1.06l-3.22 3.22h2.69a.75.75 0 0 1 0 1.5h-4.5a.75.75 0 0 1-.75-.75z"/></svg>
                </button>
            </div>
        </div>
    );
});
