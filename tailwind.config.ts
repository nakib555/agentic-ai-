import type { Config } from 'tailwindcss';

const config: Config = {
  content: [
    './src/**/*.{js,ts,jsx,tsx,mdx}',
    './index.html',
  ],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        // Background Layers
        'page': 'var(--bg-page)',
        'layer-1': 'var(--bg-layer-1)',
        'layer-2': 'var(--bg-layer-2)',
        'layer-3': 'var(--bg-layer-3)',
        'glass': 'var(--bg-glass)',
        
        // Semantic Text
        'content-primary': 'var(--text-primary)',
        'content-secondary': 'var(--text-secondary)',
        'content-tertiary': 'var(--text-tertiary)',
        'text-inverted': 'var(--text-inverted)',
        
        // Semantic Borders
        'border-subtle': 'var(--border-subtle)',
        'border-default': 'var(--border-default)',
        'border-strong': 'var(--border-strong)',
        'border-focus': 'var(--border-focus)',
        
        // Alias standard border to semantic default for easy refactoring
        'border': 'var(--border-default)',

        // Primary Brand Colors
        'primary-main': 'var(--primary-main)',
        'primary-hover': 'var(--primary-hover)',
        'primary-subtle': 'var(--primary-subtle)',
        'primary-text': 'var(--primary-text)',

        // Status Indicators
        'status-error-bg': 'var(--status-error-bg)',
        'status-error-text': 'var(--status-error-text)',
        'status-success-bg': 'var(--status-success-bg)',
        'status-success-text': 'var(--status-success-text)',
        'status-warning-bg': 'var(--status-warning-bg)',
        'status-warning-text': 'var(--status-warning-text)',

        // Backward Compatibility
        'theme-bg-light': 'var(--bg-page)',

        // UI Specifics
        'message-user': 'var(--bg-message-user)',
        'message-ai': 'var(--bg-message-ai)',
        'input-main': 'var(--bg-input)',
        'input-sub': 'var(--bg-input-secondary)',
        'code-surface': 'var(--bg-code)',
        'code-text': 'var(--text-code)',
        'sidebar-surface': 'var(--bg-sidebar)',
      },
      fontFamily: {
        sans: ['Inter', 'sans-serif'],
        mono: ['Fira Code', 'monospace'],
        display: ['Space Grotesk', 'sans-serif'],
      },
      keyframes: {
        'shimmer-wave': {
          '0%': { transform: 'translateX(-100%)' },
          '100%': { transform: 'translateX(100%)' },
        },
      },
      animation: {
        'shimmer-wave': 'shimmer-wave 2s infinite linear',
      },
    },
  },
  plugins: [],
};

export default config;