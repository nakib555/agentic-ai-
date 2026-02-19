
import React, { useEffect, useRef, useState } from 'react';
import JXG from 'jsxgraph';
import { v4 as uuidv4 } from 'uuid';

interface JSXGraphRendererProps {
    code: string; // JavaScript code to execute
    height?: number | string;
    className?: string;
}

export const JSXGraphRenderer: React.FC<JSXGraphRendererProps> = ({ code, height = 500, className }) => {
    const containerId = useRef(`jxgbox-${uuidv4()}`).current;
    const [error, setError] = useState<string | null>(null);
    const boardRef = useRef<any>(null);

    useEffect(() => {
        // Cleanup previous board
        if (boardRef.current) {
            JXG.JSXGraph.freeBoard(boardRef.current);
            boardRef.current = null;
        }

        try {
            // Clear container content just in case
            const container = document.getElementById(containerId);
            if (container) container.innerHTML = '';

            // Execute the code
            // We provide 'JXG' and 'containerId' to the function scope
            // The code is expected to initialize the board using JXG.JSXGraph.initBoard(containerId, ...)
            // and return the board instance, or we can try to detect it.
            // Actually, it's safer if we just let the code run.
            
            const func = new Function('JXG', 'containerId', `
                try {
                    ${code}
                } catch (e) {
                    throw e;
                }
            `);

            func(JXG, containerId);

            // Try to find the board we just created to store ref for cleanup
            // JXG.boards is an object where keys are element IDs
            if ((JXG as any).boards[containerId]) {
                boardRef.current = (JXG as any).boards[containerId];
            }

        } catch (err: any) {
            console.error("JSXGraph Execution Error:", err);
            setError(err.message || "Failed to execute JSXGraph code");
        }

        return () => {
            if (boardRef.current) {
                JXG.JSXGraph.freeBoard(boardRef.current);
            }
        };
    }, [code, containerId]);

    if (error) {
        return (
            <div className="p-4 border border-red-200 bg-red-50 text-red-700 rounded-lg text-sm">
                <strong>Error rendering JSXGraph:</strong>
                <pre className="mt-2 whitespace-pre-wrap">{error}</pre>
            </div>
        );
    }

    return (
        <div 
            id={containerId} 
            className={`jxgbox w-full bg-white rounded-lg border border-gray-200 overflow-hidden ${className || ''}`}
            style={{ height: height, width: '100%' }}
        />
    );
};
