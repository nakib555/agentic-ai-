
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

/**
 * Parses raw chart content based on the engine type.
 * @param engine The engine type (plotly, d3, hybrid)
 * @param content The inner content of the tag
 */
export const parseChartConfig = (engine: ChartEngine, content: string): ChartConfig => {
    const config: ChartConfig = { engine };
    
    const trimmed = content.trim();

    if (engine === 'plotly') {
        // Expect JSON
        try {
             // Attempt to fix common JSON errors if any (like trailing commas) before parsing
             // But primarily trust the model's output
            const data = JSON.parse(trimmed);
            if (data.data) config.data = data.data;
            if (data.layout) config.layout = data.layout;
            
            // If it's just an array, assume it's data
            if (Array.isArray(data)) {
                config.data = data;
            }
        } catch (e) {
            console.error("Failed to parse Plotly JSON:", e);
            // Fallback: empty chart
        }
    } else {
        // D3 or Hybrid: Content is raw script
        config.script = trimmed;
    }

    return config;
};

// Deprecated: Legacy markdown parser kept for backward compatibility if needed, 
// though the new system uses explicit tags.
export const parseChartMarkdown = (content: string): ChartConfig => {
    // Basic fallback to default plotly if no engine specified (legacy behavior)
    return parseChartConfig('plotly', content);
};
