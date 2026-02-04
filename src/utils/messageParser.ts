
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

  // Rule 2: Active Thinking / Streaming
  // If the model is still generating, and we haven't seen a final answer marker yet,
  // we assume everything so far is part of the thought process/agent log.
  // This keeps the main chat bubble clean while the "Thinking..." accordion or sidebar updates.
  if (isThinking) {
    return { thinkingText: text, finalAnswerText: '' };
  }

  // Rule 3: Generation Stopped (Finished or Error) WITHOUT Final Answer Marker
  // This handles cases where the model crashed, was interrupted, or just didn't follow protocol.
  // We fallback to showing the entire text as the final answer to ensure the user sees *something*
  // rather than an empty bubble. The sidebar will be empty in this case, but visibility is priority.
  return { thinkingText: '', finalAnswerText: text.trim() };
};
