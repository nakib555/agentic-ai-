
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
    // 1. Try standard JSON parse on original string
    try {
        return JSON.parse(str);
    } catch (e) { /* continue */ }
    
    // 2. Extract potential JSON part (removes "Here is the data:" prefixes)
    const candidate = extractJsonCandidate(str);
    
    // 3. Try standard JSON parse on candidate
    try {
        return JSON.parse(candidate);
    } catch (e) { /* continue */ }

    // 4. Try JS Eval on candidate (Handles trailing commas, unquoted keys, comments)
    // This is often the most successful method for LLM output.
    try {
         // eslint-disable-next-line no-new-func
         return new Function(`return ${candidate}`)();
    } catch (evalErr) {
        // 5. Try simple regex fix for trailing commas as last resort
        try {
            const fixed = candidate.replace(/,(\s*[\]}])/g, '$1');
            return JSON.parse(fixed);
        } catch (e) {
             // ignore
        }
        
        console.warn("UniversalChart: JSON Parse failed.", { original: str, candidate });
        // Throw the original error or the eval error to give context
        throw evalErr;
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
