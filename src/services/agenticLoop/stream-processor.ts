
/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export interface StreamCallbacks {
    onStart?: (requestId: string) => void;
    onTextChunk: (text: string) => void;
    onWorkflowUpdate: (workflow: any) => void;
    onToolCallStart: (events: any[]) => void;
    onToolUpdate: (event: any) => void;
    onToolCallEnd: (event: any) => void;
    onPlanReady: (plan: string) => void;
    onFrontendToolRequest: (callId: string, name: string, args: any) => void;
    onComplete: (data: { finalText: string, groundingMetadata: any }) => void;
    onError: (error: any) => void;
    onCancel?: () => void;
}

/**
 * Processes a streaming response from the backend API.
 * Uses a time-based and size-based buffer to batch rapid text chunks for optimal UI performance.
 */
export const processBackendStream = async (response: Response, callbacks: StreamCallbacks, signal?: AbortSignal) => {
    if (!response.body) {
        throw new Error("Response body is missing");
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';

    // --- Performance Optimization: Adaptive Buffered State Updates ---
    // Fine-grained refinement: We use a tight interval but flush immediately 
    // upon detecting structural markers (newlines, code blocks, UI components).
    // This ensures layout shifts happen instantly while bulk text is smoothed out.
    // Adjusted to 50ms to reduce React Render Cycle pressure (20fps updates for data is sufficient since typewriter handles visuals).
    const FLUSH_INTERVAL_MS = 50; 
    const MAX_BUFFER_SIZE = 50; // Buffer more chars before forcing flush
    // Increased timeout to 2 minutes to handle "Thinking" models which may pause for long periods
    const WATCHDOG_TIMEOUT_MS = 120000;

    let pendingText: string | null = null;
    let flushTimeoutId: any = null;

    const flushTextUpdates = () => {
        // Only flush if we actually have text content
        if (pendingText !== null && pendingText.length > 0) {
            callbacks.onTextChunk(pendingText);
            pendingText = null;
        }
        if (flushTimeoutId !== null) {
            clearTimeout(flushTimeoutId);
            flushTimeoutId = null;
        }
    };

    // Helper to read with a timeout to prevent infinite hanging
    const readWithTimeout = async () => {
        const timeoutPromise = new Promise<never>((_, reject) => {
            setTimeout(() => reject(new Error("Stream timeout: No data received from backend")), WATCHDOG_TIMEOUT_MS);
        });
        return Promise.race([reader.read(), timeoutPromise]);
    };

    try {
        while (true) {
            if (signal?.aborted) {
                reader.cancel();
                break;
            }

            const { done, value } = await readWithTimeout();
            
            if (done) break;
            
            buffer += decoder.decode(value, { stream: true });
            const lines = buffer.split('\n');
            // Keep the last line in the buffer if it's incomplete
            buffer = lines.pop() || '';

            for (const line of lines) {
                if (!line.trim()) continue;
                try {
                    const event = JSON.parse(line);
                    
                    // Prioritize text chunks for the buffering optimization
                    if (event.type === 'text-chunk') {
                        // ACCUMULATE deltas instead of replacing
                        pendingText = (pendingText || '') + event.payload; 
                        
                        const isBufferFull = pendingText!.length >= MAX_BUFFER_SIZE;
                        
                        // Fine-grain Check: Flush immediately on structural tokens
                        // This prevents "jumping" UI by ensuring newlines and markdown blocks render ASAP
                        const hasPriorityToken = /[\n`\[\]{};:]/.test(event.payload);
                        
                        // Check for component tags
                        const hasArtifactTag = pendingText!.includes('[ARTIFACT') || pendingText!.includes('[/ARTIFACT') || pendingText!.includes('[STEP]');

                        // Flush if buffer is full or we hit a special tag
                        if (isBufferFull || hasArtifactTag || hasPriorityToken) {
                            flushTextUpdates();
                        } else if (flushTimeoutId === null) {
                            flushTimeoutId = setTimeout(flushTextUpdates, FLUSH_INTERVAL_MS);
                        }
                        continue;
                    }

                    // For all other events (tools, errors, complete), flush pending text IMMEDIATELY
                    // to ensure correct ordering of events (e.g. text before tool call).
                    flushTextUpdates();

                    switch (event.type) {
                        case 'start':
                            callbacks.onStart?.(event.payload?.requestId);
                            break;
                        case 'ping':
                            // Keep-alive, ignore
                            break;
                        case 'workflow-update':
                            // Deprecated from backend, but kept for compatibility
                            if (callbacks.onWorkflowUpdate) callbacks.onWorkflowUpdate(event.payload);
                            break;
                        case 'tool-call-start':
                            callbacks.onToolCallStart(event.payload);
                            break;
                        case 'tool-update':
                            callbacks.onToolUpdate(event.payload);
                            break;
                        case 'tool-call-end':
                            callbacks.onToolCallEnd(event.payload);
                            break;
                        case 'plan-ready':
                            callbacks.onPlanReady(event.payload);
                            break;
                        case 'frontend-tool-request':
                            callbacks.onFrontendToolRequest(event.payload.callId, event.payload.toolName, event.payload.toolArgs);
                            break;
                        case 'complete':
                            callbacks.onComplete(event.payload);
                            break;
                        case 'error':
                            callbacks.onError(event.payload);
                            break;
                        case 'cancel':
                            callbacks.onCancel?.();
                            break;
                        default:
                            console.warn(`[StreamProcessor] Unknown event type: ${event.type}`);
                    }
                } catch(e) {
                    console.error("[StreamProcessor] Failed to parse stream event:", line, e);
                }
            }
        }
    } catch (e: any) {
        // If it's a timeout or network error, report it
        if (e.message && (e.message.includes("timeout") || e.message.includes("network"))) {
            callbacks.onError({ message: "Stream connection lost or timed out." });
        } else if (e.name !== 'AbortError') {
             // Only report actual errors, not user cancellations
             callbacks.onError({ message: e.message || "Stream processing failed" });
        }
    } finally {
        // Cleanup any pending flush on stream end/error/close
        flushTextUpdates();
        reader.releaseLock();
    }
};
