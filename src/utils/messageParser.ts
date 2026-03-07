
/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

type ParseResult = {
  thinkingText: string;
  finalAnswerText: string;
};

/**
 * Parses the raw text from a model's message into distinct "thinking" and "final answer" parts.
 * This function uses the `isThinking` and `hasError` flags to provide context and prevent UI flickering.
 * @param text The raw text content from the message.
 * @param isThinking A boolean indicating if the model is still processing.
 * @param hasError A boolean indicating if an error occurred.
 * @returns An object containing `thinkingText` and `finalAnswerText`.
 */
export const parseMessageText = (text: string, isThinking: boolean, hasError: boolean): ParseResult => {
  const finalAnswerMarker = '[STEP] Final Answer:';
  const finalAnswerIndex = text.lastIndexOf(finalAnswerMarker);

  // Rule 1: Highest priority. If the final answer marker exists, we can definitively split the text.
  // This is true whether the stream is still technically "thinking" or not.
  if (finalAnswerIndex !== -1) {
    const thinkingText = text.substring(0, finalAnswerIndex);
    let rawFinalAnswer = text.substring(finalAnswerIndex + finalAnswerMarker.length);
    
    // Strip the agent tag (e.g., ": [AGENT: Reporter]") from the beginning of the final answer.
    const agentTagRegex = /^\s*:?\s*\[AGENT:\s*[^\]]+\]\s*/;
    rawFinalAnswer = rawFinalAnswer.replace(agentTagRegex, '');

    const finalAnswerText = rawFinalAnswer.replace(/\[AUTO_CONTINUE\]/g, '').trim();
    return { thinkingText, finalAnswerText };
  }

  // Rule 1.5: Support for <think> tags (DeepSeek, etc.)
  if (text.includes('<think>')) {
    const thinkStartIndex = text.indexOf('<think>');
    const thinkEndIndex = text.indexOf('</think>');
    
    if (thinkEndIndex !== -1) {
      // Thinking is complete
      const thinkingText = text.substring(thinkStartIndex + 7, thinkEndIndex).trim();
      const finalAnswerText = text.substring(thinkEndIndex + 8).trim();
      return { thinkingText, finalAnswerText };
    } else {
      // Still thinking
      const thinkingText = text.substring(thinkStartIndex + 7).trim();
      return { thinkingText, finalAnswerText: '' };
    }
  }

  // Rule 2: Active Thinking / Streaming (Agentic)
  // If the model is still generating, and we haven't seen a final answer marker yet,
  // we assume everything so far is part of the thought process/agent log ONLY IF it contains a [STEP] marker.
  // Otherwise, it's a normal chat stream and should be shown immediately.
  const isAgentic = text.includes('[STEP]');

  if (isAgentic) {
    if (isThinking) {
      return { thinkingText: text, finalAnswerText: '' };
    }
    // Rule 3: Generation Stopped (Finished or Error) WITHOUT Final Answer Marker
    // This handles cases where the model crashed, was interrupted, or just didn't follow protocol.
    return { thinkingText: '', finalAnswerText: text.trim() };
  }

  // Normal Chat Stream: Everything is the final answer, streamed in real-time.
  return { thinkingText: '', finalAnswerText: text };
};
