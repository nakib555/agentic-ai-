
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
    // We use a time-based and size-based buffer to batch rapid text chunks.
    // Structural markers (newlines, code blocks) trigger an immediate flush
    // to keep the UI feeling responsive and "real-time".
    const FLUSH_THRESHOLD_MS = 32; // Batch for ~2 frames to reduce React render pressure
    const MAX_BUFFER_CHARS = 120;  // Flush if we accumulate significant text
    const WATCHDOG_TIMEOUT_MS = 120000;

    let pendingText = '';
    let lastFlushTime = performance.now();
    let flushTimeoutId: any = null;

    const flushTextUpdates = () => {
        if (pendingText.length > 0) {
            callbacks.onTextChunk(pendingText);
            pendingText = '';
            lastFlushTime = performance.now();
        }
        if (flushTimeoutId !== null) {
            clearTimeout(flushTimeoutId);
            flushTimeoutId = null;
        }
    };

    const scheduleFlush = () => {
        if (flushTimeoutId !== null) return;
        
        const now = performance.now();
        const timeSinceLastFlush = now - lastFlushTime;
        const remainingTime = Math.max(0, FLUSH_THRESHOLD_MS - timeSinceLastFlush);
        
        flushTimeoutId = setTimeout(flushTextUpdates, remainingTime);
    };

    // Helper to read with a timeout to prevent infinite hanging
    const readWithTimeout = async () => {
        let timeoutId: any;
        const timeoutPromise = new Promise<never>((_, reject) => {
            timeoutId = setTimeout(() => reject(new Error("Stream timeout: No data received from backend")), WATCHDOG_TIMEOUT_MS);
        });
        try {
            return await Promise.race([reader.read(), timeoutPromise]);
        } finally {
            clearTimeout(timeoutId);
        }
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
                        const chunk = event.payload || '';
                        pendingText += chunk; 
                        
                        const isBufferFull = pendingText.length >= MAX_BUFFER_CHARS;
                        
                        // Structural markers: Flush immediately to ensure layout/markdown renders correctly
                        // We check for newlines, code blocks, list markers, and common punctuation that ends a "thought"
                        const hasStructuralMarker = /[\n\r`\[\]{};:*#?]/.test(chunk);
                        
                        // Component tags also force an immediate flush
                        const hasComponentTag = chunk.includes('[') || chunk.includes(']');

                        if (isBufferFull || hasStructuralMarker || hasComponentTag) {
                            flushTextUpdates();
                        } else {
                            scheduleFlush();
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
