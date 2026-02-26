
/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { ThemeMode } from './types';

class ThemeControlCenterService {
  private currentMode: ThemeMode = 'system';
  private mediaQuery: MediaQueryList | null = null;

  constructor() {
    try {
      if (typeof window !== 'undefined' && window.matchMedia) {
        this.mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
      } else {
        console.warn('[ThemeControlCenter] window.matchMedia is not available.');
      }
    } catch (e) {
      console.error('[ThemeControlCenter] Failed to initialize media query:', e);
    }
  }

  public activateTheme(mode: ThemeMode) {
    this.currentMode = mode;

    if (mode === 'system') {
      this.handleSystemMode();
    } else {
      this.applyThemeFile(mode);
    }
  }

  private handleSystemMode() {
    const resolvedTheme = (this.mediaQuery && this.mediaQuery.matches) ? 'dark' : 'light';
    this.applyThemeFile(resolvedTheme);
  }

  private applyThemeFile(theme: 'light' | 'dark') {
    if (typeof document !== 'undefined') {
        const root = document.documentElement;
        if (theme === 'dark') {
          root.classList.add('dark');
          root.classList.remove('light');
        } else {
          root.classList.remove('dark');
          root.classList.add('light');
        }
    }
  }

  public getMediaQuery() {
    return this.mediaQuery;
  }
}

export const themeControlCenter = new ThemeControlCenterService();
