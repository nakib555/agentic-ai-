/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { GoogleGenAI, Part, FunctionCall, FinishReason, Content } from "@google/genai";
import { parseApiError } from "../../utils/apiError";
import { ToolCallEvent } from "../../types";
import { getText, generateContentStreamWithRetry } from "../../utils/geminiUtils";
import { v4 as uuidv4 } from 'uuid';

// --- Types & Interfaces ---

type Callbacks = {
    onTextChunk: (text: string) => void;
    onNewToolCalls: (toolCallEvents: ToolCallEvent[]) => void;
    onToolResult: (id: string, result: string) => void;
    onPlanReady: (plan: string) => Promise<boolean | string>;
    onComplete: (finalText: string, groundingMetadata: any) => void;
    onCancel: () => void;
    onError: (error: any) => void;
    onFrontendToolRequest: (callId: string, name: string, args: any) => void;
};

type RunAgenticLoopParams = {
    ai: GoogleGenAI;
    model: string;
    history: Content[];
    toolExecutor: (name: string, args: any, id: string) => Promise<string>;
    callbacks: Callbacks;
    settings: any;
    signal: AbortSignal;
    threadId: string;
};

const generateId = () => uuidv4();
const MAX_RETRIES = 2; // Max retries per tool call failure
const MAX_TURNS = 20;  // Max conversation turns to prevent infinite loops

class Orchestrator {
    private history: Content[];
    private turns = 0;
    private finalAnswerAccumulator = "";
    private finalGroundingMetadata: any = undefined;
    
    constructor(
        private params: RunAgenticLoopParams
    ) {
        this.history = [...params.history];
    }

    private log(message: string, data?: any) {
        console.log(`[ORCHESTRATOR:${this.params.threadId}] ${message}`, data || '');
    }

    /**
     * The Main Execution Loop.
     * Mimics a Temporal Workflow by maintaining state and handling retries/recovery steps.
     */
    async start() {
        const { ai, model, settings, signal, callbacks } = this.params;
        this.log('Starting Durable Execution Loop');

        let effectiveSystemInstruction = settings.systemInstruction || '';

        // Only append strict orchestration instructions if in Agent Mode.
        // In Chat Mode, we want a conversational flow without [BRIEFING] or [STEP] blocks.
        if (settings.isAgentMode) {
            const agenticSystemSuffix = `
            
            CRITICAL ORCHESTRATION INSTRUCTIONS:
            1.  **Briefing First:** If this is the start of a task, output a [BRIEFING] block.
            2.  **Step-by-Step:** Use [STEP] blocks for every action.
            3.  **Error Handling:** If a tool fails, analyze the error in a [STEP] Corrective Action block and retry with fixed parameters.
            4.  **Finality:** When done, strictly output [STEP] Final Answer:.
            `;
            effectiveSystemInstruction += agenticSystemSuffix;
        }

        try {
            while (this.turns < MAX_TURNS) {
                if (signal.aborted) throw new Error("AbortError");
                this.turns++;
                this.log(`Turn ${this.turns}/${MAX_TURNS}`);

                // --- PHASE 1: GENERATION (The Thought) ---
                let fullTextResponse = '';
                let toolCalls: FunctionCall[] = [];
                let groundingMetadata: any = undefined;

                const streamResult = await generateContentStreamWithRetry(ai, {
                    model,
                    contents: this.history,
                    config: {
                        ...settings,
                        systemInstruction: effectiveSystemInstruction
                    },
                });

                for await (const chunk of streamResult) {
                    if (signal.aborted) throw new Error("AbortError");

                    // Safety Check
                    const candidate = chunk.candidates?.[0];
                    if (candidate?.finishReason === FinishReason.SAFETY) {
                        throw new Error("Response was blocked due to safety policy.");
                    }

                    const chunkText = getText(chunk);
                    if (chunkText) {
                        fullTextResponse += chunkText;
                        this.finalAnswerAccumulator = fullTextResponse; 
                        callbacks.onTextChunk(chunkText);
                    }
                }

                const response = await streamResult.response;
                toolCalls = response?.functionCalls || [];
                groundingMetadata = response?.candidates?.[0]?.groundingMetadata;
                if (groundingMetadata) this.finalGroundingMetadata = groundingMetadata;

                // Add Model Response to History
                const newContentParts: Part[] = [];
                if (fullTextResponse) newContentParts.push({ text: fullTextResponse });
                if (toolCalls.length > 0) toolCalls.forEach(fc => newContentParts.push({ functionCall: fc }));
                
                this.history.push({ role: 'model', parts: newContentParts });

                // --- PHASE 2: TERMINATION CHECK ---
                // If no tool calls and we have a response, we are likely done.
                // However, we explicitly check for the "Final Answer" marker to be sure,
                // or if the model just chatted without tools.
                if (toolCalls.length === 0) {
                    this.log('No tool calls detected. Completing workflow.');
                    break;
                }

                // --- PHASE 3: EXECUTION (The Act) ---
                this.log(`Executing ${toolCalls.length} tools in parallel...`);
                
                // Create UI Events
                const newToolCallEvents: ToolCallEvent[] = toolCalls.map(fc => ({
                    id: `${fc.name}-${generateId()}`,
                    call: fc,
                    startTime: Date.now()
                }));
                callbacks.onNewToolCalls(newToolCallEvents);

                // Execute Tools
                const toolResults = await this.executeTools(toolCalls, newToolCallEvents);

                // Add Tool Outputs to History
                this.history.push({ role: 'user', parts: toolResults });
            }

            if (!signal.aborted) {
                this.log('Workflow Completed Successfully.');
                callbacks.onComplete(this.finalAnswerAccumulator, this.finalGroundingMetadata);
            }

        } catch (error: any) {
            this.handleError(error);
        }
    }

    /**
     * Executes tools with automatic retry logic for transient failures.
     */
    private async executeTools(toolCalls: FunctionCall[], events: ToolCallEvent[]): Promise<Part[]> {
        const { toolExecutor, callbacks, signal } = this.params;

        const results = await Promise.all(toolCalls.map(async (call) => {
            if (signal.aborted) return null;
            const event = events.find(e => e.call === call)!;
            const toolId = event.id;

            let attempt = 0;
            let lastError: any;

            while (attempt <= MAX_RETRIES) {
                try {
                    // Execute
                    const result = await toolExecutor(call.name || '', call.args, toolId);
                    
                    // Success
                    callbacks.onToolResult(toolId, result);
                    event.result = result;
                    event.endTime = Date.now();
                    
                    return {
                        functionResponse: {
                            name: call.name,
                            response: { result },
                        }
                    };
                } catch (error) {
                    lastError = error;
                    attempt++;
                    const isRetryable = attempt <= MAX_RETRIES; // We could add specific error checking here
                    
                    if (isRetryable && !signal.aborted) {
                        this.log(`Tool ${call.name} failed (Attempt ${attempt}). Retrying...`);
                        // Exponential backoff
                        await new Promise(r => setTimeout(r, 1000 * Math.pow(2, attempt)));
                    } else {
                        // Final Failure
                        const parsedError = parseApiError(error);
                        const errorMessage = `Tool execution failed after ${attempt} attempts: ${parsedError.message}`;
                        
                        callbacks.onToolResult(toolId, errorMessage);
                        event.result = errorMessage;
                        event.endTime = Date.now();

                        // Return the error as a result so the model can see it and "Self-Correct"
                        return {
                            functionResponse: {
                                name: call.name,
                                response: { error: errorMessage },
                            }
                        };
                    }
                }
            }
            return null;
        }));

        return results.filter(r => r !== null) as Part[];
    }

    private handleError(error: any) {
        if (error.message === 'AbortError' || error.name === 'AbortError') {
            this.log('Workflow Cancelled.');
            this.params.callbacks.onCancel();
        } else {
            console.error('[ORCHESTRATOR] Workflow Crash:', error);
            this.params.callbacks.onError(parseApiError(error));
        }
    }
}

export const runAgenticLoop = async (params: RunAgenticLoopParams): Promise<void> => {
    const orchestrator = new Orchestrator(params);
    await orchestrator.start();
};