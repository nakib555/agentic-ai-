
/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState, useEffect, useRef, useCallback } from 'react';

/**
 * A hook that progressively reveals text to simulate a typewriter effect.
 * 
 * PERFORMANCE OPTIMIZATION:
 * This hook uses a "Time Budget" strategy with fixed intervals.
 * 1. It limits React state updates to prevent blocking the main thread.
 * 2. It calculates how many characters to add based on the remaining queue size.
 */
export const useTypewriter = (targetText: string, isThinking: boolean) => {
  // If we are not thinking (e.g. history load), show text immediately
  const [displayedText, setDisplayedText] = useState(() => isThinking ? '' : targetText);
  
  const currentLength = useRef(isThinking ? 0 : targetText.length);
  const targetTextRef = useRef(targetText);
  const timerRef = useRef<number | null>(null);
  const prevIsThinking = useRef(isThinking);

  // Fixed tick rate for consistent UI performance
  // 25ms = 40fps. This is the sweet spot between smoothness and CPU load.
  // Previous 12ms (80fps) caused layout thrashing on heavy Markdown pages.
  const TICK_RATE = 25;

  const loop = useCallback(() => {
      const targetLen = targetTextRef.current.length;
      
      // Stop if caught up
      if (currentLength.current >= targetLen) {
          timerRef.current = null;
          return;
      }

      // --- ADAPTIVE SPEED CALCULATION ---
      // We calculate how many characters to add this frame to keep up with the stream.
      // Values adjusted for 25ms tick rate to maintain similar Words-Per-Minute throughput.
      const remainingChars = targetLen - currentLength.current;
      let charsToAdd = 1;

      // Acceleration logic:
      if (remainingChars > 1500) charsToAdd = 300;    // Massive catch-up
      else if (remainingChars > 800) charsToAdd = 150; // Very Fast
      else if (remainingChars > 400) charsToAdd = 75; // Fast
      else if (remainingChars > 150) charsToAdd = 35; // Moderate Fast
      else if (remainingChars > 50) charsToAdd = 15;   // Cruising speed
      else if (remainingChars > 20) charsToAdd = 8;   // Decent pace
      else charsToAdd = 3; // Base speed

      currentLength.current += charsToAdd;
      
      // Clamp to prevent overshooting
      if (currentLength.current > targetLen) currentLength.current = targetLen;

      setDisplayedText(targetTextRef.current.slice(0, currentLength.current));
      
      // Use setTimeout instead of RAF to decouple from screen refresh rate
      // and prevent main thread starvation on low-end devices
      timerRef.current = window.setTimeout(loop, TICK_RATE);
  }, []);

  useEffect(() => {
    targetTextRef.current = targetText;
    
    const wasThinking = prevIsThinking.current;
    prevIsThinking.current = isThinking;

    // CASE 1: NOT THINKING (Generation Done or History Item)
    if (!isThinking) {
        // If we were just thinking, this is a stream completion. 
        // We do NOT snap immediately. We let the loop finish the buffer gracefully.
        if (wasThinking) {
            // Ensure loop is running if there is text left to type
            if (timerRef.current === null && currentLength.current < targetText.length) {
                loop();
            }
            return;
        }

        // We were NOT thinking previously. This is likely a history navigation or branch switch.
        // We SNAP immediately to avoid re-typing the whole message.
        if (currentLength.current !== targetText.length) {
            currentLength.current = targetText.length;
            setDisplayedText(targetText);
        }
        if (timerRef.current) {
            clearTimeout(timerRef.current);
            timerRef.current = null;
        }
        return;
    } 
    
    // CASE 2: THINKING (Active Generation)
    // If target text shrunk (e.g. user edited message causing regen start), snap back immediately.
    if (targetText.length < currentLength.current) {
        currentLength.current = targetText.length;
        setDisplayedText(targetText);
    }
    
    // Ensure loop is running if there is work to do
    if (timerRef.current === null && currentLength.current < targetText.length) {
        loop();
    }
  }, [targetText, isThinking, loop]);

  useEffect(() => {
      return () => {
          if (timerRef.current) clearTimeout(timerRef.current);
      };
  }, []);

  return displayedText;
};
