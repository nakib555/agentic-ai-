
/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState, useEffect, useRef, useCallback } from 'react';

/**
 * A hook that progressively reveals text to simulate a typewriter effect.
 * 
 * PERFORMANCE OPTIMIZATION:
 * This hook uses a "Time Budget" strategy.
 * 1. It limits React state updates to prevent blocking the main thread.
 * 2. It calculates how many characters to add based on the remaining queue size.
 */
export const useTypewriter = (targetText: string, isThinking: boolean) => {
  // If we are not thinking (e.g. history load), show text immediately
  const [displayedText, setDisplayedText] = useState(() => isThinking ? '' : targetText);
  
  const currentLength = useRef(isThinking ? 0 : targetText.length);
  const targetTextRef = useRef(targetText);
  const rafRef = useRef<number | null>(null);
  const lastUpdateRef = useRef<number>(0);
  const prevIsThinking = useRef(isThinking);

  useEffect(() => {
    targetTextRef.current = targetText;
    
    const wasThinking = prevIsThinking.current;
    prevIsThinking.current = isThinking;

    // CASE 1: NOT THINKING (Generation Done or History Item)
    if (!isThinking) {
        // If we were just thinking, this is a stream completion. 
        // We do NOT snap. We let the loop finish the buffer gracefully.
        if (wasThinking) {
            // Ensure loop is running if there is text left to type
            if (rafRef.current === null && currentLength.current < targetText.length) {
                rafRef.current = requestAnimationFrame(loop);
            }
            return;
        }

        // We were NOT thinking previously. This is likely a history navigation or branch switch.
        // We SNAP immediately to avoid re-typing the whole message.
        if (currentLength.current !== targetText.length) {
            currentLength.current = targetText.length;
            setDisplayedText(targetText);
        }
        if (rafRef.current) {
            cancelAnimationFrame(rafRef.current);
            rafRef.current = null;
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
    if (rafRef.current === null && currentLength.current < targetText.length) {
        rafRef.current = requestAnimationFrame(loop);
    }
  }, [targetText, isThinking]);


  const loop = useCallback((timestamp: number) => {
      const targetLen = targetTextRef.current.length;
      
      // Stop if caught up
      if (currentLength.current >= targetLen) {
          rafRef.current = null;
          return;
      }

      // --- PERFORMANCE THROTTLE ---
      // Dynamic throttling based on content length.
      let minRenderInterval = 32; // Default 30fps
      
      if (currentLength.current > 5000) {
          minRenderInterval = 150; // 6fps for massive content
      } else if (currentLength.current > 2000) {
          minRenderInterval = 100; // 10fps for large content
      } else if (currentLength.current > 500) {
          minRenderInterval = 64; // ~15fps for medium content
      }
      
      if (timestamp - lastUpdateRef.current < minRenderInterval) {
          rafRef.current = requestAnimationFrame(loop);
          return;
      }

      // --- ADAPTIVE SPEED CALCULATION ---
      const remainingChars = targetLen - currentLength.current;
      let charsToAdd = 1;

      // Acceleration: The further behind we are, the faster we type.
      if (remainingChars > 5000) charsToAdd = 2000;     // Instant catch-up
      else if (remainingChars > 2000) charsToAdd = 500; // Very Fast
      else if (remainingChars > 1000) charsToAdd = 150; // Fast
      else if (remainingChars > 500) charsToAdd = 50;   // Moderate Fast
      else if (remainingChars > 200) charsToAdd = 20;   // Reading speed
      else if (remainingChars > 100) charsToAdd = 10;   // Decent pace
      else if (remainingChars > 50) charsToAdd = 5;     // Natural
      else if (remainingChars > 20) charsToAdd = 3;     // Deceleration

      // Adjust chars to add based on the throttle
      if (minRenderInterval > 32) {
          charsToAdd = Math.ceil(charsToAdd * (minRenderInterval / 32));
      }

      currentLength.current += charsToAdd;
      
      // Clamp to prevent overshooting
      if (currentLength.current > targetLen) currentLength.current = targetLen;

      setDisplayedText(targetTextRef.current.slice(0, currentLength.current));
      
      lastUpdateRef.current = timestamp;
      rafRef.current = requestAnimationFrame(loop);
  }, []);

  useEffect(() => {
      return () => {
          if (rafRef.current) cancelAnimationFrame(rafRef.current);
      };
  }, []);

  return displayedText;
};
