
/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect, useState } from 'react';
import ReactECharts from 'echarts-for-react';

export type ChartEngine = 'echarts';

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
    if (clean.startsWith('```')) {
        clean = clean.replace(/^```[a-z]*\n?/, '').replace(/```$/, '').trim();
    }
    return clean;
};

// Robust parser that handles trailing commas, comments, and unquoted keys
const looseJsonParse = (str: string) => {
    try {
        return JSON.parse(str);
    } catch (e) {
        // Fallback for LLM quirks
        try {
             // Security/Sanity check: ensure it starts/ends with brackets
            const trimmed = str.trim();
            if ((trimmed.startsWith('{') && trimmed.endsWith('}')) || 
                (trimmed.startsWith('[') && trimmed.endsWith(']'))) {
                 // Evaluate as a JavaScript object literal to support trailing commas/comments
                 // eslint-disable-next-line no-new-func
                 return new Function(`return ${str}`)();
            }
        } catch (evalErr) {
            // Ignore eval error and throw original JSON error if both fail
        }
        throw e;
    }
};

export const UniversalChart: React.FC<UniversalChartProps> = React.memo(({ content, code }) => {
    const [config, setConfig] = useState<EChartsConfig | null>(null);
    const [error, setError] = useState<string | null>(null);
    
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
                
                // Parse the JSON option object
                const option = looseJsonParse(trimmedCode);
                
                setConfig({ option });
                setError(null);
            } 
        } catch (e: any) {
            console.error("ECharts parsing error:", e);
            setError(`Failed to render chart: ${e.message}. Please check the data format.`);
        }
    }, [content, code]);

    if (error) {
        return (
            <div className="my-4 p-4 border border-red-200 bg-red-50 dark:bg-red-900/10 rounded-lg text-sm text-red-600 dark:text-red-400 font-mono overflow-auto">
                <div className="font-bold mb-1">Visualization Error</div>
                <div className="whitespace-pre-wrap">{error}</div>
            </div>
        );
    }

    if (!config) {
        return <div className="h-64 bg-gray-100 dark:bg-white/5 rounded-lg animate-pulse my-6" />;
    }

    return (
        <div className="my-6 border border-gray-200 dark:border-white/10 rounded-2xl overflow-hidden bg-white dark:bg-[#121212] shadow-sm relative z-0 group transition-colors duration-300">
            {/* Header */}
            <div className="px-4 py-2 border-b border-gray-100 dark:border-white/5 flex justify-between items-center bg-slate-50/50 dark:bg-white/5 backdrop-blur-sm">
                <div className="flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-indigo-500 shadow-[0_0_8px_rgba(99,102,241,0.6)]"></span>
                    <span className="text-[10px] font-bold uppercase tracking-widest text-slate-500 dark:text-slate-400">
                        Apache ECharts
                    </span>
                </div>
            </div>
            
            {/* Chart Canvas */}
            <div className="p-4 bg-white dark:bg-[#121212]">
                <ReactECharts
                    option={config.option}
                    theme={isDark ? 'dark' : undefined}
                    style={{ height: config.height || 400, width: '100%' }}
                    opts={{ renderer: 'svg' }} // Use SVG for sharper text rendering
                />
            </div>
        </div>
    );
});
