
/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect, useState, useRef, useMemo } from 'react';
import ReactECharts from 'echarts-for-react';
import * as echarts from 'echarts';

export type ChartEngine = 'echarts' | 'html';

type UniversalChartProps = {
    content?: string; // Legacy support for markdown parsing or raw code
    engine?: string;
    code?: string; // Raw content from XML tag
    onFixCode?: (code: string, error?: string) => Promise<string | undefined>;
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

    // 4. Try JS Eval on candidate with echarts context
    try {
         // eslint-disable-next-line no-new-func
         const func = new Function('echarts', `return ${jsFriendly}`);
         return func(echarts);
    } catch (evalErr) {
        throw evalErr;
    }
};

/**
 * SMART LAYOUT ENGINE
 * Intelligently restructures chart options to ensure responsiveness without overlapping.
 * It transforms flat options into ECharts Media Query structure if not already present.
 */
const smartLayoutAdapter = (option: any, isDark: boolean) => {
    if (!option) return option;

    // --- 1. Standardization: Convert Flat to BaseOption/Media ---
    let rootOption = option;
    let existingMedia = [];

    if (option.baseOption) {
        rootOption = JSON.parse(JSON.stringify(option.baseOption)); // Deep clone to avoid mutation
        existingMedia = option.media || [];
    } else {
        rootOption = JSON.parse(JSON.stringify(option));
    }

    // --- 2. Theming & Styling (Applied to Base) ---
    const textColor = isDark ? '#f4f4f5' : '#1e293b';
    const subTextColor = isDark ? '#a1a1aa' : '#64748b';
    const lineColor = isDark ? '#52525b' : '#e2e8f0';
    const splitLineColor = isDark ? 'rgba(255, 255, 255, 0.05)' : 'rgba(0, 0, 0, 0.05)';
    const tooltipBg = isDark ? 'rgba(24, 24, 27, 0.95)' : 'rgba(255, 255, 255, 0.95)';
    const tooltipBorder = isDark ? '#3f3f46' : '#e2e8f0';

    // Apply Colors Helper
    const applyAxisStyles = (axis: any) => {
        if (!axis) return axis;
        const axes = Array.isArray(axis) ? axis : [axis];
        return axes.map((a: any) => ({
            ...a,
            nameTextStyle: { color: subTextColor, ...a.nameTextStyle },
            axisLabel: { color: subTextColor, ...a.axisLabel },
            axisLine: { lineStyle: { color: lineColor }, ...a.axisLine },
            splitLine: { lineStyle: { color: splitLineColor }, ...a.splitLine }
        }));
    };
    
    if (rootOption.xAxis) rootOption.xAxis = applyAxisStyles(rootOption.xAxis);
    if (rootOption.yAxis) rootOption.yAxis = applyAxisStyles(rootOption.yAxis);
    
    // Ensure Legend handles overflow
    if (rootOption.legend) {
        rootOption.legend.textStyle = { color: textColor, ...rootOption.legend.textStyle };
        rootOption.legend.pageTextStyle = { color: textColor };
        rootOption.legend.type = 'scroll'; // Always scrollable for safety
        
        // Default desktop legend position if not set
        if (!rootOption.legend.top && !rootOption.legend.bottom) rootOption.legend.top = '5%';
        if (!rootOption.legend.left && !rootOption.legend.right) rootOption.legend.right = '5%';
    }
    
    if (rootOption.title) {
        const titles = Array.isArray(rootOption.title) ? rootOption.title : [rootOption.title];
        rootOption.title = titles.map((t: any) => ({
            ...t,
            textStyle: { color: textColor, fontSize: 16, ...t.textStyle },
            subtextStyle: { color: subTextColor, ...t.subtextStyle }
        }));
    }

    // Force tooltip to stay inside chart
    rootOption.tooltip = {
        trigger: 'axis',
        confine: true, // Critical: keeps tooltip inside chart container
        backgroundColor: tooltipBg,
        borderColor: tooltipBorder,
        textStyle: { color: textColor },
        ...rootOption.tooltip
    };

    // --- 3. Enforce Non-Overlapping Grid (Desktop Default) ---
    if (rootOption.grid) {
        const grids = Array.isArray(rootOption.grid) ? rootOption.grid : [rootOption.grid];
        rootOption.grid = grids.map((g: any) => ({
            containLabel: true, // The most important ECharts property for layout safety
            left: g.left || '5%',
            right: g.right || '5%',
            bottom: g.bottom || '10%', // Base spacing
            top: g.top || 60,
            ...g
        }));
    } else {
        // Inject grid if missing
        rootOption.grid = { containLabel: true, left: '5%', right: '5%', bottom: '10%', top: 60 };
    }

    // --- 4. Dynamic Media Query Generation (Mobile Optimization) ---
    // We inject a high-priority media query for screens < 650px
    const mobileQuery = {
        query: { maxWidth: 650 }, 
        option: {
            legend: {
                orient: 'horizontal',
                bottom: 0,        // Move to bottom on mobile
                left: 'center',   // Center align
                top: 'auto',      // Clear top
                right: 'auto',    // Clear right
                padding: [5, 10],
                itemGap: 10,
                type: 'scroll'    // Ensure scrolling if too many items
            },
            grid: {
                bottom: 50, // Increase bottom padding to fit the legend we moved there
                top: 50,    
                left: 10,   // Minimal safe margins
                right: 10,
                containLabel: true // Strict containment
            },
            title: {
                left: 'center', // Center title on mobile
                top: 10,
                textStyle: { fontSize: 14 }
            },
            xAxis: {
                axisLabel: {
                    rotate: 45, // Rotate labels to fit on narrow screens
                    fontSize: 10,
                    hideOverlap: true, // Automatically hide every Nth label if they collide
                    interval: 'auto'
                }
            },
            yAxis: {
                nameLocation: 'end',
                nameGap: 10,
                axisLabel: { fontSize: 10 }
            },
            toolbox: {
                show: false // Hide complex tools on mobile
            }
        }
    };

    // Merge our generated media query with any existing ones
    // We prepend ours or append depending on specificity, but here appending works as a specific override
    const finalMedia = [
        ...existingMedia,
        mobileQuery
    ];

    return {
        baseOption: rootOption,
        media: finalMedia
    };
};

export const UniversalChart: React.FC<UniversalChartProps> = React.memo(({ content, code, onFixCode, isStreaming }) => {
    const [config, setConfig] = useState<EChartsConfig | null>(null);
    const [htmlContent, setHtmlContent] = useState<string | null>(null);
    const [activeEngine, setActiveEngine] = useState<ChartEngine>('echarts');
    const [error, setError] = useState<string | null>(null);
    const [isFullscreen, setIsFullscreen] = useState(false);
    const [isFixing, setIsFixing] = useState(false);
    const [localCodeOverride, setLocalCodeOverride] = useState<string | null>(null);
    
    // Container size state
    const [containerHeight, setContainerHeight] = useState<number>(500);

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

    // Reset override when streaming starts (new generation)
    useEffect(() => {
        if (isStreaming) {
            setLocalCodeOverride(null);
            setError(null);
        }
    }, [isStreaming]);

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
                     // Check for known chart tags first to prevent mistaking them for HTML if passed raw
                     const xmlMatch = trimmedCode.match(/^<(echarts|chart)>([\s\S]*?)<\/\1>$/i);
                     if (xmlMatch) {
                         const contentString = xmlMatch[2];
                         const parsed = looseJsonParse(contentString);
                         if (parsed && typeof parsed === 'object') {
                             setActiveEngine('echarts');
                             setConfig({ option: parsed });
                             
                             // Set Initial Height based on config or heuristics
                             if (parsed.height && typeof parsed.height === 'number') {
                                 setContainerHeight(parsed.height);
                             } else {
                                 setContainerHeight(500);
                             }
                             setError(null);
                             return;
                         }
                     }

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
                        
                        // Set Initial Height based on config or heuristics
                        if (parsed.height && typeof parsed.height === 'number') {
                            setContainerHeight(parsed.height);
                        } else {
                            // Heuristic: If multiple pie series (donuts), taller default
                            const series = parsed.baseOption?.series || parsed.series;
                            if (Array.isArray(series) && series.length > 1 && series[0].type === 'pie') {
                                setContainerHeight(650);
                            } else if (Array.isArray(series) && series.length > 3) {
                                setContainerHeight(600);
                            } else {
                                setContainerHeight(500);
                            }
                        }
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

    // Compute final options using Smart Layout Adapter
    const finalOption = useMemo(() => {
        if (!config?.option) return null;
        // Pass current theme to adapter
        return smartLayoutAdapter(config.option, isDark);
    }, [config, isDark]);

    // Handle clicks/touches outside the chart to dismiss tooltip
    useEffect(() => {
        const handleClickOutside = (event: MouseEvent | TouchEvent) => {
            if (
                activeEngine === 'echarts' && 
                containerRef.current && 
                !containerRef.current.contains(event.target as Node)
            ) {
                if (echartsRef.current) {
                    try {
                        const instance = echartsRef.current.getEchartsInstance();
                        instance.dispatchAction({ type: 'hideTip' });
                        instance.dispatchAction({ type: 'updateAxisPointer', currTrigger: 'leave' });
                    } catch(e) {}
                }
            }
        };

        window.addEventListener('mousedown', handleClickOutside);
        window.addEventListener('touchstart', handleClickOutside);

        return () => {
            window.removeEventListener('mousedown', handleClickOutside);
            window.removeEventListener('touchstart', handleClickOutside);
        };
    }, [activeEngine]);

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
        // Grab the actual error message if meaningful
        const currentError = error && !error.includes('Rendering') && !error.includes('Fixing') ? error : undefined;
        
        setError('Fixing chart...'); 
        try {
            const raw = code || content || '';
            const fixedCode = await onFixCode(raw, currentError);
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

    const handleMouseLeave = () => {
        if (activeEngine === 'echarts' && echartsRef.current) {
             try {
                 const instance = echartsRef.current.getEchartsInstance();
                 instance.dispatchAction({ type: 'hideTip' });
             } catch (e) {}
        }
    };

    // --- Drag Resize Handler ---
    const startResize = (e: React.MouseEvent) => {
        e.preventDefault();
        const startY = e.clientY;
        const startHeight = containerHeight;
        
        const doDrag = (moveEvent: MouseEvent) => {
            // Min height 300px, Max height 1200px
            const newHeight = Math.min(Math.max(300, startHeight + (moveEvent.clientY - startY)), 1200);
            setContainerHeight(newHeight);
        };
        
        const stopDrag = () => {
            window.removeEventListener('mousemove', doDrag);
            window.removeEventListener('mouseup', stopDrag);
            document.body.style.cursor = 'default';
            // Force ECharts resize after drag
            if (echartsRef.current) {
                echartsRef.current.getEchartsInstance().resize();
            }
        };
        
        document.body.style.cursor = 'ns-resize';
        window.addEventListener('mousemove', doDrag);
        window.addEventListener('mouseup', stopDrag);
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
                     <span className="text-slate-500 dark:text-slate-400 font-medium truncate" title={error}>
                        {isRendering ? (isFixing ? "Fixing Graph..." : "Rendering...") : (error.length > 50 ? error.substring(0, 47) + '...' : error)}
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
                
                <div className={`w-full bg-white dark:bg-[#121212] overflow-hidden ${isFullscreen ? 'h-screen' : ''}`} style={!isFullscreen ? { height: containerHeight } : {}}>
                     <iframe 
                        srcDoc={htmlContent}
                        className="w-full h-full border-none"
                        sandbox="allow-scripts allow-forms allow-popups allow-same-origin allow-modals" 
                        title="Custom Chart"
                    />
                </div>

                 {!isFullscreen && (
                    <div 
                        className="h-3 w-full bg-slate-50 dark:bg-white/5 border-t border-gray-100 dark:border-white/5 cursor-ns-resize flex items-center justify-center hover:bg-slate-100 dark:hover:bg-white/10 transition-colors"
                        onMouseDown={startResize}
                        title="Drag to resize"
                    >
                        <div className="w-8 h-1 rounded-full bg-gray-300 dark:bg-gray-600"></div>
                    </div>
                )}
            </div>
        );
    }

    if (!finalOption) {
        return <div className="h-64 bg-gray-100 dark:bg-white/5 rounded-lg animate-pulse my-6" />;
    }

    return (
        <div 
            className="my-6 w-full rounded-xl overflow-hidden relative z-0 border border-gray-200 dark:border-white/5 bg-white dark:bg-[#18181b] shadow-sm flex flex-col"
            ref={containerRef}
            onMouseLeave={handleMouseLeave}
            style={{ transition: 'none' }} // Disable transitions during resize for perf
        >
            <div className="w-full relative flex-1">
                <ReactECharts
                    ref={echartsRef}
                    option={finalOption}
                    theme={isDark ? 'dark' : undefined}
                    style={{ height: containerHeight, width: '100%', minHeight: '300px' }}
                    opts={{ renderer: 'svg' }}
                />
            </div>

            {/* Controls Overlay */}
            <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none group-hover:pointer-events-auto z-10">
                <button 
                    onClick={toggleFullscreen}
                    className="p-2 bg-white/80 dark:bg-black/50 backdrop-blur rounded-lg text-slate-500 hover:text-indigo-500 shadow-sm transition-colors"
                    title="Fullscreen"
                >
                     <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4"><path d="M13.28 7.78l3.22-3.22v2.69a.75.75 0 0 0 1.5 0v-4.5a.75.75 0 0 0-.75-.75h-4.5a.75.75 0 0 0 0 1.5h2.69l-3.22 3.22a.75.75 0 0 0 1.06 1.06zM2 17.25v-4.5a.75.75 0 0 1 1.5 0v2.69l3.22-3.22a.75.75 0 1 1 1.06 1.06l-3.22 3.22h2.69a.75.75 0 0 1 0 1.5h-4.5a.75.75 0 0 1-.75-.75z"/></svg>
                </button>
            </div>

            {/* Resize Handle */}
            <div 
                className="h-4 w-full bg-slate-50 dark:bg-white/5 border-t border-gray-200 dark:border-white/5 cursor-ns-resize flex items-center justify-center hover:bg-slate-100 dark:hover:bg-white/10 transition-colors z-20 flex-shrink-0"
                onMouseDown={startResize}
                title="Drag to resize height"
            >
                <div className="w-12 h-1 rounded-full bg-gray-300 dark:bg-gray-600"></div>
            </div>
        </div>
    );
});
