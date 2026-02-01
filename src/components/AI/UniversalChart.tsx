
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
 * Now intelligently handles both flat options and `baseOption`/`media` structures.
 */
const enforceResponsiveConfig = (option: any, isDark: boolean) => {
    if (!option) return option;
    
    const isResponsiveStructure = !!option.baseOption;
    
    // If it's a responsive structure, we apply safety settings to the baseOption.
    // If it's a flat structure, we apply to the root.
    const target = isResponsiveStructure ? { ...option.baseOption } : { ...option };

    // --- SAFETY DEFAULTS (Applied to both modes) ---
    
    // 1. Background
    if (!target.backgroundColor) {
        target.backgroundColor = 'transparent';
    }

    // 2. Tooltip Confinement (Prevents overflow)
    target.tooltip = {
        confine: true,
        appendToBody: true,
        trigger: 'item', // Default to item for safety with diverse charts
        backgroundColor: isDark ? 'rgba(24, 24, 27, 0.9)' : 'rgba(255, 255, 255, 0.9)',
        borderColor: isDark ? '#3f3f46' : '#e2e8f0',
        textStyle: { color: isDark ? '#f4f4f5' : '#1e293b' },
        padding: [10, 15],
        extraCssText: 'box-shadow: 0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -2px rgba(0, 0, 0, 0.05); border-radius: 8px; backdrop-filter: blur(8px); z-index: 50;',
        ...target.tooltip
    };

    // 3. Grid Safety (Only apply if NOT using media queries, otherwise trust the AI's layout)
    if (!isResponsiveStructure) {
        // Only apply grid defaults if grid is relevant (pie charts don't usually use grid, but bar/line do)
        // However, adding a safe grid usually doesn't hurt.
        if (!target.grid) target.grid = {};
        
        target.grid = {
            containLabel: true,
            left: '2%',
            right: '2%',
            bottom: '10%',
            top: 60,
            ...target.grid
        };
        
        // Responsive Legend for flat structure
        if (target.legend) {
            target.legend = {
                type: 'scroll',
                bottom: 0,
                left: 'center',
                top: 'auto',
                padding: [5, 10],
                itemGap: 15,
                textStyle: { color: isDark ? '#a1a1aa' : '#64748b' },
                ...target.legend
            };
        }
    } else {
        // Even in responsive mode, ensure containLabel is true on base
        if (target.grid) {
             target.grid = { containLabel: true, ...target.grid };
        }
    }

    // 4. Styling Adjustments (Colors, Fonts) - Applied safely
    const fixAxis = (axis: any): any => {
        if (!axis) return axis;
        if (Array.isArray(axis)) return axis.map(fixAxis);
        return {
            ...axis,
            axisLabel: {
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

    if (target.xAxis) target.xAxis = fixAxis(target.xAxis);
    if (target.yAxis) target.yAxis = fixAxis(target.yAxis);
    
    if (target.title) {
         // Handle array title
         const titleList = Array.isArray(target.title) ? target.title : [target.title];
         target.title = titleList.map((t: any) => ({
             ...t,
             textStyle: {
                color: isDark ? '#f4f4f5' : '#1e293b',
                fontWeight: 600,
                fontSize: 14,
                ...t.textStyle
             }
         }));
    }

    // 5. Pie Chart Specifics (Prevent Overlap)
    if (target.series) {
        const seriesList = Array.isArray(target.series) ? target.series : [target.series];
        target.series = seriesList.map((s: any) => {
            if (s.type === 'pie') {
                return {
                    avoidLabelOverlap: true,
                    itemStyle: {
                        borderColor: isDark ? '#18181b' : '#ffffff',
                        borderWidth: 2,
                        ...s.itemStyle
                    },
                    label: {
                        show: true,
                        color: isDark ? '#e4e4e7' : '#334155',
                        ...s.label
                    },
                    labelLine: {
                        lineStyle: {
                            color: isDark ? '#52525b' : '#cbd5e1'
                        },
                        ...s.labelLine
                    },
                    ...s
                };
            }
            return s;
        });
    }

    // Reassemble
    if (isResponsiveStructure) {
        return {
            ...option,
            baseOption: target
        };
    }
    
    return target;
};

export const UniversalChart: React.FC<UniversalChartProps> = React.memo(({ content, code, onFixCode, isStreaming }) => {
    const [config, setConfig] = useState<EChartsConfig | null>(null);
    const [htmlContent, setHtmlContent] = useState<string | null>(null);
    const [activeEngine, setActiveEngine] = useState<ChartEngine>('echarts');
    const [error, setError] = useState<string | null>(null);
    const [isFullscreen, setIsFullscreen] = useState(false);
    const [isFixing, setIsFixing] = useState(false);
    const [localCodeOverride, setLocalCodeOverride] = useState<string | null>(null);
    
    // Resizable state
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

    // Compute final options with responsive overrides
    const finalOption = useMemo(() => {
        if (!config?.option) return null;
        return enforceResponsiveConfig(config.option, isDark);
    }, [config, isDark]);

    // Force resize on mount, window resize, and CONTAINER RESIZE
    useEffect(() => {
        const handleResize = () => {
            if (echartsRef.current) {
                echartsRef.current.getEchartsInstance().resize();
            }
        };
        window.addEventListener('resize', handleResize);
        
        // This observer watches the container div for size changes (including our drag resize)
        const resizeObserver = new ResizeObserver(() => handleResize());
        if (containerRef.current) resizeObserver.observe(containerRef.current);

        return () => {
            window.removeEventListener('resize', handleResize);
            resizeObserver.disconnect();
        };
    }, []);

    // Handle clicks/touches outside the chart to dismiss tooltip
    useEffect(() => {
        const handleClickOutside = (event: MouseEvent | TouchEvent) => {
            if (
                activeEngine === 'echarts' && 
                containerRef.current && 
                !containerRef.current.contains(event.target as Node)
            ) {
                if (echartsRef.current) {
                    const instance = echartsRef.current.getEchartsInstance();
                    instance.dispatchAction({ type: 'hideTip' });
                    instance.dispatchAction({ type: 'updateAxisPointer', currTrigger: 'leave' });
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

    const handleMouseLeave = () => {
        if (activeEngine === 'echarts' && echartsRef.current) {
             const instance = echartsRef.current.getEchartsInstance();
             instance.dispatchAction({ type: 'hideTip' });
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
                    theme={isDark && !finalOption.baseOption?.backgroundColor && !finalOption.backgroundColor ? 'dark' : undefined}
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
