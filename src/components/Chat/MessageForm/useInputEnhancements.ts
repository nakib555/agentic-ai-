/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

// This hook manages features that enhance the user's text input,
// such as voice input, prompt enhancement via AI SDK UI.

import { useState } from 'react';
import { useVoiceInput } from '../../../hooks/useVoiceInput';
import { useCompletion } from 'ai/react';
import { toast } from 'sonner';

export const useInputEnhancements = (
    inputValue: string,
    setInputValue: (value: string) => void,
    hasFiles: boolean,
    onSubmit: (message: string, files?: File[], options?: { isThinkingModeEnabled?: boolean }) => void
) => {
  
  // Use Vercel AI SDK for prompt enhancement
  // We use streamProtocol: 'text' because the backend sends raw text chunks
  const { complete, isLoading: isEnhancing } = useCompletion({
    api: '/api/handler?task=enhance',
    streamProtocol: 'text',
    onFinish: (prompt, completion) => {
        setInputValue(completion);
    },
    onError: (err) => {
        console.error("Prompt enhancement failed:", err);
        toast.error("Failed to enhance prompt.");
        // Restore original if needed, though useCompletion usually handles input state separately.
        // Since we update `inputValue` live via `onResponse` logic below or via useEffect, we are good.
    }
  });

  // --- Voice Input ---
  const { isRecording, startRecording, stopRecording, isSupported } = useVoiceInput({
    onTranscriptUpdate: setInputValue,
  });

  // --- Event Handlers ---
  const handleEnhancePrompt = async () => {
    const originalPrompt = inputValue;
    if (!originalPrompt.trim() || isEnhancing) return;

    if (originalPrompt.trim().split(' ').length < 3) {
        toast.info("Prompt is too short to enhance.");
        return;
    }

    try {
        // Clear input to show it rewriting
        setInputValue(''); 
        
        // Trigger completion. 
        // Note: useCompletion sends the prompt in the body automatically.
        // We pass the prompt to `complete` which handles the fetch.
        // We use the returned promise or just let the hook state update.
        const result = await complete(originalPrompt);
        
        if (result) {
            setInputValue(result);
        }
    } catch (e) {
        setInputValue(originalPrompt); // Restore on error
    }
  };

  const handleMicClick = () => {
    isRecording ? stopRecording() : (setInputValue(''), startRecording());
  };

  return {
    isEnhancing,
    isRecording,
    startRecording,
    stopRecording,
    isSupported,
    handleEnhancePrompt,
    handleMicClick,
  };
};