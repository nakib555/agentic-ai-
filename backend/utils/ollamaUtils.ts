
/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

// This file is deprecated. 
// The Ollama implementation has been moved to `backend/providers/ollama.ts`.
// Please do not use `streamOllama` from this file as it contains legacy hardcoded endpoints.

export const streamOllama = async () => {
    throw new Error("This function is deprecated. Please use the ProviderRegistry.");
};
