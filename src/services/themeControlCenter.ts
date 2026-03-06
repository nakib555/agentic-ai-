
/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import lightTheme from '../theme/light';
import darkTheme from '../theme/dark';
import systemTheme from '../theme/system';

export type ThemeMode = 'light' | 'dark' | 'system';

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

  /**
   * Activates the specified theme mode.
   * This acts as the central switchboard for the entire UI.
   */
  public activateTheme(mode: ThemeMode) {
    // console.log(`[ThemeControlCenter] Activating mode: ${mode}`);
    this.currentMode = mode;

    if (mode === 'system') {
      this.handleSystemMode();
    } else {
      this.applyThemeFile(mode);
    }
  }

  /**
   * Logic for System Mode: Detects preference and redirects.
   */
  private handleSystemMode() {
    const systemConfig = systemTheme; // Reading from system.ts
    if (systemConfig.autoDetect) {
      // Default to light if media query is unavailable
      const resolvedTheme = (this.mediaQuery && this.mediaQuery.matches) ? 'dark' : 'light';
      // console.log(`[ThemeControlCenter] System mode detected: ${resolvedTheme}`);
      this.applyThemeFile(resolvedTheme);
    }
  }

  /**
   * Loads the specific theme file and injects values into the DOM.
   */
  private applyThemeFile(theme: 'light' | 'dark') {
    let themeTokens;
    switch (theme) {
        case 'dark': themeTokens = darkTheme; break;
        default: themeTokens = lightTheme; break;
    }

    if (typeof document !== 'undefined') {
        const root = document.documentElement;

        // 1. Inject CSS Variables (The Colors)
        Object.entries(themeTokens).forEach(([key, value]) => {
          root.style.setProperty(key, String(value));
        });

        // 2. Update Browser Theme Color
        // This ensures the mobile status bar / browser chrome matches the theme background
        const pageBg = (themeTokens as any)['--bg-page'];
        if (pageBg) {
            this.updateMetaThemeColor(pageBg);
        }

        // 3. Toggle Tailwind Class (The Utilities)
        if (theme === 'dark') {
          root.classList.add('dark');
          root.classList.remove('light');
        } else {
          root.classList.remove('dark');
          root.classList.add('light');
        }
    }
  }

  /**
   * Updates the <meta name="theme-color"> tag dynamically
   */
  private updateMetaThemeColor(color: string) {
    const meta = document.querySelector('meta[name="theme-color"]');
    if (meta) {
        meta.setAttribute('content', color);
    } else {
        const newMeta = document.createElement('meta');
        newMeta.name = "theme-color";
        newMeta.content = color;
        document.head.appendChild(newMeta);
    }
  }

  /**
   * Returns the media query list for external listeners.
   */
  public getMediaQuery() {
    return this.mediaQuery;
  }
}

export const themeControlCenter = new ThemeControlCenterService();
