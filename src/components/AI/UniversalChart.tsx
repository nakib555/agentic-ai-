
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
        // Fix: Remove keys that are missing values before a closing brace (e.g. "borderRadius": })
        .replace(/"[\w\d_]+"\s*:\s*(?=\})/g, '')
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
                
                if (option && typeof option === 'object') {
                    setConfig({ option });
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
                console.warn("ECharts parsing warning:", e.message);
            }
            setError(`Rendering...`); 
        }
    }, [content, code]);

    if (error) {
        return (
            <div className="my-6 p-4 border border-gray-200 dark:border-white/10 bg-gray-50 dark:bg-white/5 rounded-xl text-sm flex items-center gap-3">
                 <div className="animate-spin w-4 h-4 border-2 border-indigo-500 border-t-transparent rounded-full"></div>
                 <span className="text-slate-500 dark:text-slate-400 font-medium">Generating visualization...</span>
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
