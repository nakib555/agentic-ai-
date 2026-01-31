
/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect, useRef, useState, useMemo } from 'react';
// Use factory to create Plot component to avoid bundling issues with Vite/React
import Plotly from 'plotly.js-dist-min';
import createPlotlyComponent from 'react-plotly.js/factory';
import * as d3 from 'd3';
import { ErrorDisplay } from '../UI/ErrorDisplay';

const Plot = createPlotlyComponent(Plotly);

export type ChartEngine = 'plotly' | 'd3' | 'hybrid';

type UniversalChartProps = {
    content?: string; // Legacy support
    engine?: ChartEngine;
    code?: string;
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

    // Effect to parse configuration from either legacy content or new props
    useEffect(() => {
        try {
            // New XML-tag based flow
            if (engine && code) {
                const newConfig: ChartConfig = { engine };
                
                if (engine === 'd3') {
                    newConfig.script = code.trim();
                } else {
                    // Plotly or Hybrid: Parse JSON
                    const jsonStr = code.trim();
                    if (jsonStr) {
                         // Fix common AI JSON mistakes (trailing commas)
                        const fixedJson = jsonStr.replace(/,\s*([\]}])/g, '$1');
                        const parsedData = JSON.parse(fixedJson);
                        
                        newConfig.data = parsedData.data;
                        newConfig.layout = parsedData.layout;
                        newConfig.script = parsedData.script; // Hybrid script
                    }
                }
                setConfig(newConfig);
                setError(null);
                setPlotKey(p => p + 1);
            } 
            // Legacy markdown-based parsing logic (kept for backward compatibility with old chats)
            else if (content) {
                import('../../utils/chartParser').then(({ parseChartMarkdown }) => {
                    const parsed = parseChartMarkdown(content);
                    setConfig(parsed);
                    setError(null);
                    setPlotKey(p => p + 1);
                });
            }
        } catch (e: any) {
            setError(`Failed to parse chart configuration: ${e.message}`);
        }
    }, [content, engine, code]);

    // Handle D3 and Hybrid Scripting
    useEffect(() => {
        if (!config || !containerRef.current) return;
        if (config.engine === 'plotly') return; // Plotly handled by component

        const executeD3 = async () => {
            // Cleanup previous D3
            if (config.engine === 'd3') {
                d3.select(containerRef.current).selectAll('*').remove();
            }

            if (config.script) {
                try {
                    // Give Plotly a moment to render if hybrid
                    if (config.engine === 'hybrid') {
                        await new Promise(resolve => setTimeout(resolve, 100));
                    }

                    const func = new Function('d3', 'container', 'width', 'height', 'Plotly', config.script);
                    func(
                        d3, 
                        containerRef.current, 
                        config.width || containerRef.current.clientWidth, 
                        config.height || 400,
                        (window as any).Plotly
                    );
                } catch (e: any) {
                    console.error("Chart Script Error:", e);
                    setError(`Script execution failed: ${e.message}`);
                }
            }
        };

        executeD3();

    }, [config, plotKey]);

    if (error) {
        return (
            <div className="my-4 p-4 border border-red-200 bg-red-50 dark:bg-red-900/10 rounded-lg text-sm text-red-600">
                <strong>Chart Error:</strong> {error}
            </div>
        );
    }

    if (!config) return <div className="h-64 bg-gray-100 dark:bg-white/5 rounded-lg animate-pulse" />;

    const chartStyle = { 
        width: '100%', 
        height: config.height ? `${config.height}px` : '400px' 
    };

    return (
        <div className="my-6 border border-gray-200 dark:border-white/10 rounded-xl overflow-hidden bg-white dark:bg-[#121212] shadow-sm relative z-0">
            <div className="px-4 py-2 border-b border-gray-100 dark:border-white/5 flex justify-between items-center bg-slate-50/50 dark:bg-white/5">
                <span className="text-xs font-bold uppercase tracking-wider text-slate-500">
                    {config.engine === 'hybrid' ? 'Hybrid (Plotly + D3)' : config.engine === 'd3' ? 'D3 Visualization' : 'Plotly Chart'}
                </span>
            </div>
            
            <div className="relative p-4 overflow-hidden" style={chartStyle}>
                {/* Plotly Layer */}
                {(config.engine === 'plotly' || config.engine === 'hybrid') && (
                    <Plot
                        key={plotKey}
                        data={config.data || []}
                        layout={{
                            autosize: true,
                            margin: { t: 30, r: 10, l: 40, b: 40 },
                            paper_bgcolor: 'transparent',
                            plot_bgcolor: 'transparent',
                            font: { color: '#64748b' }, // Slate-500
                            ...config.layout,
                        }}
                        useResizeHandler={true}
                        style={{ width: '100%', height: '100%' }}
                        config={{ displayModeBar: true, responsive: true }}
                        divId={config.engine === 'hybrid' ? undefined : undefined}
                    />
                )}

                {/* D3 Layer (or Container for D3) */}
                <div 
                    ref={containerRef} 
                    className={`absolute inset-0 pointer-events-none ${config.engine === 'd3' ? 'pointer-events-auto' : ''}`}
                    style={{ zIndex: 10 }}
                />
            </div>
        </div>
    );
});
