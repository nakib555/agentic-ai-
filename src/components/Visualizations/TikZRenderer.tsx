
import React, { useEffect, useRef, useState } from 'react';
import { ErrorBoundary } from '../ErrorBoundary';

interface TikZRendererProps {
    code: string;
    className?: string;
}

export const TikZRenderer: React.FC<TikZRendererProps> = ({ code, className }) => {
    const containerRef = useRef<HTMLDivElement>(null);
    const [error, setError] = useState<string | null>(null);
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        const loadTikZ = async () => {
            if (typeof window === 'undefined') return;

            // Check if TikZJax is already loaded
            if (!document.querySelector('script[src*="tikzjax.js"]')) {
                const script = document.createElement('script');
                script.src = "https://tikzjax.com/v1/tikzjax.js";
                script.async = true;
                document.head.appendChild(script);
                
                // Wait for script to load
                await new Promise((resolve, reject) => {
                    script.onload = resolve;
                    script.onerror = reject;
                });
            }

            // TikZJax automatically processes scripts with type="text/tikz"
            // We need to manually trigger it or let it observe.
            // However, inserting the script tag into the DOM usually triggers it.
            setIsLoading(false);
        };

        loadTikZ().catch(err => {
            console.error("Failed to load TikZJax", err);
            setError("Failed to load TikZ renderer.");
            setIsLoading(false);
        });
    }, []);

    useEffect(() => {
        if (!isLoading && containerRef.current) {
            // Clear previous content
            containerRef.current.innerHTML = '';
            
            // Create script tag
            const script = document.createElement('script');
            script.type = 'text/tikz';
            script.textContent = code;
            
            containerRef.current.appendChild(script);

            // If TikZJax is loaded, it should process this. 
            // If it doesn't automatically pick up dynamic additions, we might need to call a function.
            // Looking at TikZJax docs, it uses a MutationObserver, so it should work.
        }
    }, [code, isLoading]);

    if (error) return <div className="text-red-500 text-sm p-4">{error}</div>;

    return (
        <div className={`w-full overflow-x-auto p-4 bg-white rounded-lg border border-gray-200 ${className || ''}`}>
             {isLoading && (
                <div className="flex items-center justify-center h-40">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600"></div>
                </div>
            )}
            <div ref={containerRef} className="flex justify-center min-h-[200px]" />
        </div>
    );
};
