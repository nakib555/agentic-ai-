/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */
import { GoogleGenAI } from "@google/genai";
import { ToolError } from "../utils/apiError";
import { executeImageGenerator } from './imageGenerator';
import { executeWebSearch } from './webSearch';
import { executeAnalyzeMapVisually, executeAnalyzeImageVisually } from './visualAnalysis';
import { executeCode } from "./codeExecutor";
import { executeVideoGenerator } from "./videoGenerator";
import { executeCalculator } from "./calculator";
import { executeListFiles, executeDisplayFile, executeDeleteFile, executeWriteFile } from "./fileTools";
import { executeDisplayMap } from "./map";
import { executeBrowser } from "./browser";
import { v4 as uuidv4 } from 'uuid';

const generateId = () => uuidv4();

// We define a custom type for the tool executor to handle the optional onUpdate callback
type ToolImplementation = (ai: GoogleGenAI, args: any, apiKey: string, chatId: string, onUpdate?: (data: any) => void) => Promise<string>;

const BACKEND_TOOL_IMPLEMENTATIONS: Record<string, ToolImplementation> = {
    'generateImage': (ai, args, apiKey, chatId) => executeImageGenerator(ai, args, chatId),
    'duckduckgoSearch': (ai, args) => executeWebSearch(ai, args),
    'browser': (ai, args, apiKey, chatId, onUpdate) => executeBrowser(args, onUpdate), // Pass onUpdate
    'analyzeMapVisually': (ai, args) => executeAnalyzeMapVisually(ai, args),
    'analyzeImageVisually': (ai, args, apiKey, chatId) => executeAnalyzeImageVisually(ai, args, chatId),
    'executeCode': (ai, args, apiKey, chatId) => executeCode(args, chatId),
    'generateVideo': (ai, args, apiKey, chatId) => executeVideoGenerator(ai, args, apiKey!, chatId),
    'calculator': (ai, args) => Promise.resolve(executeCalculator(args)),
    'writeFile': (ai, args, apiKey, chatId) => executeWriteFile(args, chatId),
    'listFiles': (ai, args, apiKey, chatId) => executeListFiles(args, chatId),
    'displayFile': (ai, args, apiKey, chatId) => executeDisplayFile(args, chatId),
    'deleteFile': (ai, args, apiKey, chatId) => executeDeleteFile(args, chatId),
    'displayMap': (ai, args) => Promise.resolve(executeDisplayMap(args)),
};

const FRONTEND_TOOLS = new Set([
    'getCurrentLocation',
    'requestLocationPermission',
    'captureCodeOutputScreenshot',
    'generateVideo',
]);

export const createToolExecutor = (
    ai: GoogleGenAI,
    imageModel: string,
    videoModel: string,
    apiKey: string,
    chatId: string,
    requestFrontendExecution: (callId: string, toolName: string, toolArgs: any) => Promise<string | { error: string }>,
    skipFrontendCheck: boolean = false,
    onToolUpdate?: (id: string, data: any) => void // New callback
) => {
    // The returned function now accepts an ID
    return async (name: string, args: any, id: string): Promise<string> => {
        console.log(`[TOOL_EXECUTOR] Received request to execute tool: "${name}"`, { args, chatId, id });
        
        if (!skipFrontendCheck && FRONTEND_TOOLS.has(name)) {
            // Use the provided ID if available, otherwise generate one
            const callId = id || `${name}-${generateId()}`;
            const result = await requestFrontendExecution(callId, name, args);
            if (typeof result === 'object' && result.error) {
                throw new ToolError(name, 'FRONTEND_EXECUTION_FAILED', result.error);
            }
            return result as string;
        }

        const toolImplementation = BACKEND_TOOL_IMPLEMENTATIONS[name];
        if (!toolImplementation) {
            console.error(`[TOOL_EXECUTOR] Tool not found: "${name}"`);
            throw new ToolError(name, 'TOOL_NOT_FOUND', `Tool "${name}" is not implemented on the backend.`);
        }

        try {
            let finalArgs = { ...args };
            if (name === 'generateImage' && imageModel) finalArgs.model = imageModel;
            if (name === 'generateVideo' && videoModel) finalArgs.model = videoModel;

            console.log(`[TOOL_EXECUTOR] Executing backend tool "${name}"...`);
            
            // Pass a wrapped update function that binds the ID
            const boundUpdate = onToolUpdate ? (data: any) => onToolUpdate(id, data) : undefined;
            
            const result = await toolImplementation(ai, finalArgs, apiKey, chatId, boundUpdate);
            console.log(`[TOOL_EXECUTOR] Backend tool "${name}" finished successfully.`);
            return result;
        } catch (err) {
            console.error(`[TOOL_EXECUTOR] Backend tool "${name}" failed.`, { err });
            if (err instanceof ToolError) throw err;
            const originalError = err instanceof Error ? err : new Error(String(err));
            throw new ToolError(name, 'BACKEND_EXECUTION_FAILED', originalError.message, originalError);
        }
    };
};