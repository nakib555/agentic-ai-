
/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState, useEffect } from 'react';
import { themeControlCenter, ThemeMode } from '../services/themeControlCenter';

// Re-export type for compatibility
export type Theme = ThemeMode;

export const useTheme = () => {
  const [theme, setTheme] = useState<Theme>(() => {
    try {
      if (typeof window !== 'undefined') {
        const stored = localStorage.getItem('theme') as Theme;
        // Validate against known themes (if Spocke was stored, it falls back to system)
        if (stored === 'light' || stored === 'dark' || stored === 'system') {
            return stored;
        }
      }
    } catch (e) {
      console.warn('Failed to access localStorage for theme:', e);
    }
    return 'system';
  });

  useEffect(() => {
    // 1. Trigger the Control Center
    themeControlCenter.activateTheme(theme);
    
    // 2. Persist choice
    try {
        localStorage.setItem('theme', theme);
    } catch (e) { /* ignore */ }

    // 3. Handle System Mode Dynamic Updates
    if (theme === 'system') {
      const mediaQuery = themeControlCenter.getMediaQuery();
      
      // If media query is not supported (e.g. invalid state), we can't listen for changes
      if (!mediaQuery) return;

      const handleChange = () => themeControlCenter.activateTheme('system');
      
      try {
        mediaQuery.addEventListener('change', handleChange);
        return () => mediaQuery.removeEventListener('change', handleChange);
      } catch (e) {
        // Fallback for older browsers
        try {
            mediaQuery.addListener(handleChange);
            return () => mediaQuery.removeListener(handleChange);
        } catch (e2) {
            // Ignore if both fail
        }
      }
    }
  }, [theme]);

  return { theme, setTheme };
};
