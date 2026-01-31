
/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect, useRef, useState, useMemo } from 'react';
import Plot from 'react-plotly.js';
import * as d3 from 'd3';
import { parseChartMarkdown, ChartConfig } from '../../utils/chartParser';
import { ErrorDisplay } from '../UI/ErrorDisplay';

type UniversalChartProps = {
    content: string;
};

export const UniversalChart: React.FC<UniversalChartProps> = React.memo(({ content }) => {
    const containerRef = useRef<HTMLDivElement>(null);
    const [config, setConfig] = useState<ChartConfig | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [plotKey, setPlotKey] = useState(0); // Force re-render for hybrid

    // Parse configuration
    useEffect(() => {
        try {
            const parsed = parseChartMarkdown(content);
            setConfig(parsed);
            setError(null);
            setPlotKey(p => p + 1);
        } catch (e) {
            setError('Failed to parse chart configuration.');
        }
    }, [content]);

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
                        (window as any).Plotly // Access global Plotly if available/needed
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
        <div className="my-6 border border-gray-200 dark:border-white/10 rounded-xl overflow-hidden bg-white dark:bg-[#121212] shadow-sm">
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
                        config={{ displayModeBar: false, responsive: true }}
                        divId={config.engine === 'hybrid' ? undefined : undefined} // Let Plotly manage ID unless specific
                    />
                )}

                {/* D3 Layer (or Container for D3) */}
                {/* For Hybrid, this acts as an overlay or wrapper depending on D3 logic */}
                <div 
                    ref={containerRef} 
                    className={`absolute inset-0 pointer-events-none ${config.engine === 'd3' ? 'pointer-events-auto' : ''}`}
                    style={{ zIndex: 10 }}
                />
            </div>
        </div>
    );
});
