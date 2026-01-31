
/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect, useRef, useState } from 'react';
// Use factory to create Plot component to avoid bundling issues with Vite/React
import Plotly from 'plotly.js-dist-min';
import createPlotlyComponent from 'react-plotly.js/factory';
import * as d3 from 'd3';

const Plot = createPlotlyComponent(Plotly);

export type ChartEngine = 'plotly' | 'd3' | 'hybrid';

type UniversalChartProps = {
    content?: string; // Legacy support for markdown parsing
    engine?: ChartEngine;
    code?: string; // Raw content from XML tag
};

interface ChartConfig {
    engine: ChartEngine;
    data?: any;
    layout?: any;
    script?: string;
    width?: number;
    height?: number;
}

export const UniversalChart: React.FC<UniversalChartProps> = React.memo(({ content, engine, code }) => {
    const containerRef = useRef<HTMLDivElement>(null);
    const [config, setConfig] = useState<ChartConfig | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [plotKey, setPlotKey] = useState(0);

    // Effect to parse configuration
    useEffect(() => {
        try {
            // Priority 1: New XML-tag based flow (<plotly>, <d3>, <hybrid>)
            if (engine && code) {
                const newConfig: ChartConfig = { engine };
                const trimmedCode = code.trim();

                if (engine === 'd3') {
                    // For D3, the content is raw JavaScript
                    newConfig.script = trimmedCode;
                } else {
                    // For Plotly or Hybrid, the content is JSON
                    if (trimmedCode) {
                         // Robust JSON parsing: Attempt to fix common LLM JSON syntax errors
                        let jsonStr = trimmedCode;
                        
                        // Remove markdown code block wrappers if the AI accidentally added them
                        if (jsonStr.startsWith('```')) {
                            jsonStr = jsonStr.replace(/^```(json)?/, '').replace(/```$/, '');
                        }
                        
                        // Remove potential trailing commas before closing braces/brackets
                        jsonStr = jsonStr.replace(/,\s*([\]}])/g, '$1');

                        const parsedData = JSON.parse(jsonStr);
                        
                        newConfig.data = parsedData.data;
                        newConfig.layout = parsedData.layout;
                        if (engine === 'hybrid') {
                            newConfig.script = parsedData.script;
                        }
                    }
                }
                setConfig(newConfig);
                setError(null);
                setPlotKey(p => p + 1); // Force re-render of Plotly
            } 
            // Priority 2: Legacy markdown-based parsing logic (@engine: syntax)
            else if (content) {
                import('../../utils/chartParser').then(({ parseChartMarkdown }) => {
                    const parsed = parseChartMarkdown(content);
                    setConfig(parsed);
                    setError(null);
                    setPlotKey(p => p + 1);
                });
            }
        } catch (e: any) {
            console.error("Chart parsing error:", e);
            setError(`Failed to render chart: ${e.message}`);
        }
    }, [content, engine, code]);

    // Handle D3 and Hybrid Scripting Execution
    useEffect(() => {
        const container = containerRef.current;
        if (!config || !container) return;
        
        // Pure Plotly is handled by the <Plot /> component below
        if (config.engine === 'plotly') return;

        const executeD3 = async () => {
            try {
                // Clear previous D3 content
                // We use d3 selection to clear to ensure event listeners are removed
                d3.select(container).selectAll('*').remove();

                if (config.script) {
                    // Short delay to ensure DOM and Layout are ready
                    await new Promise(resolve => setTimeout(resolve, 50));

                    // Execute the script in a function wrapper
                    // We pass D3, container, and dimensions as context
                    const func = new Function('d3', 'container', 'width', 'height', 'Plotly', config.script);
                    
                    const width = container.clientWidth || 600;
                    const height = config.height || 400;

                    func(
                        d3, 
                        container, 
                        width, 
                        height,
                        (window as any).Plotly // Pass Plotly global if needed for hybrid
                    );
                }
            } catch (e: any) {
                console.error("D3 Script Execution Error:", e);
                setError(`Visualization script error: ${e.message}`);
            }
        };

        executeD3();

    }, [config, plotKey]);

    if (error) {
        return (
            <div className="my-4 p-4 border border-red-200 bg-red-50 dark:bg-red-900/10 rounded-lg text-sm text-red-600 dark:text-red-400 font-mono">
                <div className="font-bold mb-1">Visualization Error</div>
                {error}
            </div>
        );
    }

    if (!config) {
        return <div className="h-64 bg-gray-100 dark:bg-white/5 rounded-lg animate-pulse my-6" />;
    }

    const chartStyle = { 
        width: '100%', 
        height: config.height ? `${config.height}px` : (config.engine === 'd3' ? 'auto' : '400px'),
        minHeight: config.engine === 'd3' ? '200px' : '400px'
    };

    return (
        <div className="my-6 border border-gray-200 dark:border-white/10 rounded-xl overflow-hidden bg-white dark:bg-[#121212] shadow-sm relative z-0 group">
            {/* Header */}
            <div className="px-4 py-2 border-b border-gray-100 dark:border-white/5 flex justify-between items-center bg-slate-50/50 dark:bg-white/5">
                <div className="flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-indigo-500"></span>
                    <span className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                        {config.engine === 'hybrid' ? 'Hybrid Visualization' : config.engine === 'd3' ? 'D3 Visualization' : 'Plotly Chart'}
                    </span>
                </div>
            </div>
            
            {/* Canvas */}
            <div className="relative p-4 overflow-hidden" style={chartStyle}>
                
                {/* Plotly Render Layer */}
                {(config.engine === 'plotly' || config.engine === 'hybrid') && (
                    <Plot
                        key={plotKey}
                        data={config.data || []}
                        layout={{
                            autosize: true,
                            margin: { t: 30, r: 10, l: 40, b: 40 },
                            paper_bgcolor: 'transparent',
                            plot_bgcolor: 'transparent',
                            font: { 
                                color: document.documentElement.classList.contains('dark') ? '#94a3b8' : '#64748b',
                                family: 'Inter, sans-serif'
                            },
                            ...config.layout,
                        }}
                        useResizeHandler={true}
                        style={{ width: '100%', height: '100%' }}
                        config={{ 
                            displayModeBar: true, 
                            displaylogo: false,
                            responsive: true,
                            modeBarButtonsToRemove: ['lasso2d', 'select2d']
                        }}
                    />
                )}

                {/* D3 Render Layer (Overlay or Standalone) */}
                <div 
                    ref={containerRef} 
                    className={`absolute inset-0 p-4 ${config.engine === 'd3' ? 'relative inset-auto p-0' : 'pointer-events-none'}`}
                    style={{ zIndex: 10 }}
                />
            </div>
        </div>
    );
});
