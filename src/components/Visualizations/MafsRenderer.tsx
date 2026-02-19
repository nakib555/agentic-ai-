
import React, { useMemo } from 'react';
import * as Mafs from "mafs";
import "mafs/core.css";
import "mafs/font.css";
import { ErrorBoundary } from '../ErrorBoundary';

interface MafsRendererProps {
    config: any; // JSON configuration for the scene
    height?: number;
    width?: number;
}

// Recursive component renderer
const renderComponent = (node: any, key: string | number): React.ReactNode => {
    if (!node) return null;
    if (typeof node === 'string' || typeof node === 'number') return node;

    const { type, props = {}, children } = node;
    
    // Resolve component from Mafs export
    // Handle nested components like Plot.OfX
    const Component = type.split('.').reduce((acc: any, part: string) => acc && acc[part], Mafs);

    if (!Component) {
        console.warn(`Mafs component not found: ${type}`);
        return null;
    }

    // Process props to handle functions
    const processedProps = { ...props };
    Object.keys(processedProps).forEach(propKey => {
        const val = processedProps[propKey];
        if (typeof val === 'string' && (val.includes('=>') || val.startsWith('function'))) {
            try {
                // eslint-disable-next-line no-new-func
                processedProps[propKey] = new Function('return ' + val)();
            } catch (e) {
                console.error(`Failed to parse function prop ${propKey}:`, val, e);
            }
        }
    });

    const renderedChildren = Array.isArray(children) 
        ? children.map((child: any, i: number) => renderComponent(child, i))
        : (children ? renderComponent(children, 0) : null);

    return React.createElement(Component, { ...processedProps, key }, renderedChildren);
};

export const MafsRenderer: React.FC<MafsRendererProps> = ({ config, height = 500, width = 500 }) => {
    const renderedContent = useMemo(() => {
        try {
            // If config is string, parse it
            let parsedConfig = config;
            if (typeof config === 'string') {
                // Use a loose parser or just JSON.parse
                // For now, assume valid JSON or JS object string
                // We can use the same looseJsonParse from UniversalChart if we export it, 
                // but for now let's try basic parsing or eval if it's a JS object string
                try {
                    parsedConfig = JSON.parse(config);
                } catch (e) {
                    // Try eval for JS object strings (risky but needed for AI output often)
                    // eslint-disable-next-line no-new-func
                    parsedConfig = new Function('return ' + config)();
                }
            }
            
            // If the root is not Mafs, wrap it? 
            // Usually the AI will output the whole tree including <Mafs>
            // But if they just output children, we might need to wrap.
            // Let's assume the AI outputs a root object with type "Mafs".
            // If not, we wrap it.
            if (parsedConfig.type !== 'Mafs') {
                parsedConfig = {
                    type: 'Mafs',
                    props: { height, width },
                    children: Array.isArray(parsedConfig) ? parsedConfig : [parsedConfig]
                };
            }

            return renderComponent(parsedConfig, 'root');
        } catch (e) {
            console.error("Failed to render Mafs config:", e);
            return <div className="text-red-500">Failed to render Mafs visualization.</div>;
        }
    }, [config, height, width]);

    return (
        <div className="mafs-container w-full overflow-hidden rounded-lg border border-gray-200 bg-white">
            <ErrorBoundary fallback={<div className="p-4 text-red-500">Something went wrong rendering the math visualization.</div>}>
                {renderedContent}
            </ErrorBoundary>
        </div>
    );
};
