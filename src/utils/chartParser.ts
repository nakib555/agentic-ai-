
/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export type ChartEngine = 'echarts';

export interface ChartConfig {
    engine: ChartEngine;
    option?: any;
    width?: number;
    height?: number;
}

export const parseChartMarkdown = (content: string): ChartConfig => {
    const lines = content.split('\n');
    const config: ChartConfig = {
        engine: 'echarts',
    };

    let buffer = '';
    let isData = false;

    // Very simple parser for legacy @engine syntax, mostly just to catch the JSON object
    for (const line of lines) {
        const trimmed = line.trim();
        if (trimmed.startsWith('@data:') || trimmed.startsWith('{') || isData) {
            isData = true;
            buffer += line.replace('@data:', '') + '\n';
        }
    }
    
    if (buffer.trim()) {
        try {
            // Fix common AI JSON mistakes (trailing commas)
            const fixedJson = buffer.trim().replace(/,\s*([\]}])/g, '$1');
            config.option = JSON.parse(fixedJson);
        } catch (e) {
            // ignore
        }
    }
    
    return config;
};