
/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export type ChartEngine = 'plotly' | 'd3' | 'hybrid';

export interface ChartConfig {
    engine: ChartEngine;
    data?: any;
    layout?: any;
    script?: string;
    width?: number;
    height?: number;
    title?: string;
}

export const parseChartMarkdown = (content: string): ChartConfig => {
    const lines = content.split('\n');
    const config: ChartConfig = {
        engine: 'plotly', // Default
    };

    let currentSection: 'data' | 'layout' | 'script' | null = null;
    let buffer = '';

    const flushBuffer = () => {
        if (!currentSection || !buffer.trim()) return;
        
        try {
            if (currentSection === 'script') {
                config.script = buffer.trim();
            } else {
                // For data and layout, we try to parse as JSON.
                // We use a relaxed parser assumption here (JSON5-style would be better but standard JSON is safer for AI generation consistency)
                const jsonStr = buffer.trim();
                if (jsonStr) {
                    // Try parsing, if fail, leave as null/undefined
                    try {
                         // Fix common AI JSON mistakes (trailing commas)
                        const fixedJson = jsonStr.replace(/,\s*([\]}])/g, '$1');
                        (config as any)[currentSection] = JSON.parse(fixedJson);
                    } catch (e) {
                        console.warn(`[ChartParser] Failed to parse ${currentSection}:`, e);
                    }
                }
            }
        } catch (e) {
            console.error(e);
        }
        buffer = '';
    };

    for (const line of lines) {
        const trimmed = line.trim();
        
        if (trimmed.startsWith('@engine:')) {
            flushBuffer();
            const engine = trimmed.replace('@engine:', '').trim().toLowerCase();
            if (['plotly', 'd3', 'hybrid'].includes(engine)) {
                config.engine = engine as ChartEngine;
            }
            currentSection = null;
        } else if (trimmed.startsWith('@canvas:')) {
            flushBuffer();
            const params = trimmed.replace('@canvas:', '').trim();
            const widthMatch = params.match(/width=(\d+)/);
            const heightMatch = params.match(/height=(\d+)/);
            if (widthMatch) config.width = parseInt(widthMatch[1]);
            if (heightMatch) config.height = parseInt(heightMatch[1]);
            currentSection = null;
        } else if (trimmed.startsWith('@data:')) {
            flushBuffer();
            currentSection = 'data';
            // If the data is inline (e.g. @data: [...]), strip prefix and add to buffer
            const inlineContent = line.substring(line.indexOf(':') + 1).trim();
            if (inlineContent) buffer += inlineContent;
        } else if (trimmed.startsWith('@layout:')) {
            flushBuffer();
            currentSection = 'layout';
            const inlineContent = line.substring(line.indexOf(':') + 1).trim();
            if (inlineContent) buffer += inlineContent;
        } else if (trimmed.startsWith('@script:')) {
            flushBuffer();
            currentSection = 'script';
        } else {
            // Continuation of current section
            if (currentSection) {
                buffer += line + '\n';
            }
        }
    }
    
    flushBuffer();
    return config;
};
