
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

  // Fixed tick rate for consistent UI performance (30ms = ~33fps target)
  // This is smoother than 50ms but less heavy than RAF (16ms)
  const TICK_RATE = 30;

  const loop = useCallback(() => {
      const targetLen = targetTextRef.current.length;
      
      // Stop if caught up
      if (currentLength.current >= targetLen) {
          timerRef.current = null;
          return;
      }

      // --- ADAPTIVE SPEED CALCULATION ---
      const remainingChars = targetLen - currentLength.current;
      let charsToAdd = 1;

      // Acceleration: The further behind we are, the faster we type.
      // Thresholds tuned for mobile stability
      if (remainingChars > 2000) charsToAdd = 200;    // Massive catch-up
      else if (remainingChars > 1000) charsToAdd = 100; // Very Fast
      else if (remainingChars > 500) charsToAdd = 50;   // Fast
      else if (remainingChars > 200) charsToAdd = 20;   // Moderate Fast
      else if (remainingChars > 100) charsToAdd = 10;   // Reading speed
      else if (remainingChars > 50) charsToAdd = 5;     // Decent pace
      else charsToAdd = 2; // Natural base speed

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
