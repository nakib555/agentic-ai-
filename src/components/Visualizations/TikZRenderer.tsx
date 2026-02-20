
import React, { useEffect, useRef, useState } from 'react';
import { ErrorBoundary } from '../ErrorBoundary';

interface TikZRendererProps {
    code: string;
    className?: string;
}

export const TikZRenderer: React.FC<TikZRendererProps> = ({ code, className }) => {
    const containerRef = useRef<HTMLDivElement>(null);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        if (containerRef.current) {
            // Clear previous content
            containerRef.current.innerHTML = '';
            
            // Create script tag
            const script = document.createElement('script');
            script.type = 'text/tikz';
            script.textContent = code;
            
            containerRef.current.appendChild(script);

            // If TikZJax is loaded, it should process this. 
            // If not, we might need to wait or trigger it.
            // Since it's in index.html, it should be available globally.
        }
    }, [code]);

    if (error) return <div className="text-red-500 text-sm p-4">{error}</div>;

    return (
        <div className={`w-full overflow-x-auto p-4 bg-white rounded-lg border border-gray-200 ${className || ''}`}>
            <div ref={containerRef} className="flex justify-center min-h-[200px]" />
        </div>
    );
};
