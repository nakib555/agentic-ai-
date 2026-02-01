/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { MessageError } from '../../types';
import { ToolError } from '../../utils/apiError';

/**
 * Parses a generic Error from the Gemini API into a structured MessageError.
 * @param error The error object thrown by the API client.
 * @returns A structured MessageError with user-friendly content.
 */
export const parseApiError = (error: any): MessageError => {
    // If it's already a well-formed MessageError (e.g. from backend pass-through), use it.
    if (error && typeof error === 'object' && 'code' in error && 'message' in error && !('stack' in error)) {
         const safeError = { ...error };
         if (safeError.code !== undefined) safeError.code = String(safeError.code);
         return safeError as MessageError;
    }

    if (error instanceof ToolError) {
        return {
            code: error.code,
            message: `Tool Execution Failed: ${error.toolName}`,
            details: error.cause ? `${error.originalMessage}\n\nCause:\n${error.cause.stack}` : error.originalMessage,
            suggestion: error.suggestion,
        };
    }
    
    // Check if the Error object has attached metadata (from src/hooks/useChat/index.ts or src/utils/api.ts logic)
    if (error instanceof Error) {
        if ((error as any).code) {
            return {
                code: String((error as any).code),
                message: error.message,
                details: (error as any).details || error.stack,
                suggestion: (error as any).suggestion
            };
        }
    }
    
    // Extract message, details, and status for robust classification
    let message = 'An unexpected API error occurred';
    let details = '';
    let status = '';
    
    if (error instanceof Error) {
        message = error.message;
        details = error.stack || error.toString();
    } else if (typeof error === 'object' && error !== null) {
        // Handle Google API's specific structured error response like:
        // {"error":{"code":429,"message":"...", "status":"RESOURCE_EXHAUSTED"}}
        if (error.error && typeof error.error.message === 'string') {
            message = error.error.message;
            if (error.error.status && typeof error.error.status === 'string') {
                status = error.error.status;
            }
        } else if (typeof error.message === 'string') {
            message = error.message;
        }
        try {
            details = JSON.stringify(error, null, 2);
        } catch (e) {
            details = 'Could not stringify the error object.';
        }
    } else {
        message = String(error);
        details = String(error);
    }

    // Try to parse a nested JSON error message, which is common.
    if (typeof message === 'string' && message.startsWith('{') && message.endsWith('}')) {
        try {
            const nestedError = JSON.parse(message);
            if (nestedError.error) {
                if (typeof nestedError.error === 'string') {
                    message = nestedError.error;
                } else if (nestedError.error.message) {
                    message = nestedError.error.message;
                    if (nestedError.error.status) {
                        status = nestedError.error.status;
                    }
                }
            }
        } catch (e) {
            // Not a valid JSON string, proceed with the original message.
        }
    }

    const lowerCaseMessage = message.toLowerCase();
    const lowerCaseStatus = status.toLowerCase();

    // Specific check for OpenRouter Authentication Errors
    if (lowerCaseMessage.includes('openrouter') && (lowerCaseMessage.includes('401') || lowerCaseMessage.includes('user not found') || lowerCaseMessage.includes('unauthorized'))) {
        return {
            code: 'INVALID_API_KEY',
            message: 'Invalid OpenRouter API Key',
            details: 'The OpenRouter API rejected your key. Please ensure it is configured correctly in Settings.',
            suggestion: 'Your OpenRouter API key appears invalid. Please update it in the General Settings tab.'
        };
    }

    // 1. Invalid API Key
    if (lowerCaseMessage.includes('api key not valid') || lowerCaseMessage.includes('api key not found') || lowerCaseMessage.includes('api key not configured') || lowerCaseStatus === 'permission_denied') {
        return {
            code: 'INVALID_API_KEY',
            message: 'Invalid or Missing API Key',
            details: 'The API key is missing, invalid, or has expired. Please ensure it is configured correctly in your environment variables.',
            suggestion: 'Your API key is invalid or missing. Please update it in the General Settings tab.'
        };
    }

    // 2. Rate Limiting / Quota Exceeded
    if (lowerCaseStatus === 'resource_exhausted' || lowerCaseMessage.includes('429') || lowerCaseMessage.includes('rate limit')) {
        return {
            code: 'RATE_LIMIT_EXCEEDED',
            message: 'API Rate Limit Exceeded',
            details: `You have sent too many requests or exceeded your quota. Please check your API plan and billing details. Original error: ${message}`,
            suggestion: 'You have sent too many requests. Please wait a moment before trying again.'
        };
    }

    // 3. 503 Service Unavailable / Overloaded
    if (lowerCaseStatus === 'unavailable' || lowerCaseMessage.includes('503') || lowerCaseMessage.includes('overloaded')) {
        return {
            code: 'UNAVAILABLE',
            message: 'Model is temporarily unavailable',
            details: `The model is currently overloaded or down for maintenance. Please try again in a few moments. Original error: ${message}`,
            suggestion: 'The AI service is currently overloaded. Please try again in a few moments.'
        };
    }
    
    // 4. Content Blocked by Safety Settings
    if (lowerCaseMessage.includes('response was blocked') || lowerCaseMessage.includes('safety policy')) {
        return {
            code: 'CONTENT_BLOCKED',
            message: 'Response Blocked by Safety Filter',
            details: 'The model\'s response was blocked due to the safety policy. This can happen if the prompt or the generated content is deemed unsafe. Please try rephrasing your request.',
            suggestion: 'The response was blocked due to safety filters. Please try rephrasing your request.'
        };
    }
    
    // 5. Model Not Found
    if (lowerCaseStatus === 'not_found' || lowerCaseMessage.includes('404') || lowerCaseMessage.includes('model not found')) {
        return {
            code: 'MODEL_NOT_FOUND',
            message: 'Model Not Found',
            details: `The model ID specified in the request could not be found. Please check the model name and ensure you have access to it. Original error: ${message}`,
            suggestion: 'The selected model is unavailable. This may be due to regional restrictions or API key limitations. Please select a different model in Settings.'
        };
    }
    
    // 6. Invalid Argument (e.g., malformed request)
    if (lowerCaseStatus === 'invalid_argument' || lowerCaseMessage.includes('400') || lowerCaseMessage.includes('bad request')) {
        return {
            code: 'INVALID_ARGUMENT',
            message: 'Invalid Request Sent',
            details: `The request was malformed or contained invalid parameters. Details: ${message}`,
            suggestion: 'The request was malformed. This may be a temporary issue; please try again.'
        };
    }

    // 7. Network Error
    if (lowerCaseMessage.includes('failed to fetch')) {
        return {
            code: 'NETWORK_ERROR',
            message: 'Network Error',
            details: `A network problem occurred, possibly due to a lost internet connection. Original error: ${details}`,
            suggestion: 'A network problem occurred. Please check your internet connection and the backend server URL in Settings.'
        };
    }

    // Fallback for other generic API or network errors
    return {
        code: 'API_ERROR',
        message: message, // Use the extracted message
        details: details, // Use the extracted details
    };
};