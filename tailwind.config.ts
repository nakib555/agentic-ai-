import type { Config } from 'tailwindcss';
import tailwindcssAnimate from 'tailwindcss-animate';

const config: Config = {
  darkMode: ["class"],
  content: [
    './src/**/*.{js,ts,jsx,tsx,mdx}',
    './index.html',
  ],
  theme: {
    container: {
      center: true,
      padding: "2rem",
      screens: {
        "2xl": "1400px",
      },
    },
    extend: {
      colors: {
        border: "hsl(var(--border))",
        input: "hsl(var(--input))",
        ring: "hsl(var(--ring))",
        background: "hsl(var(--background))",
        foreground: "hsl(var(--foreground))",
        primary: {
          DEFAULT: "hsl(var(--primary))",
          foreground: "hsl(var(--primary-foreground))",
        },
        secondary: {
          DEFAULT: "hsl(var(--secondary))",
          foreground: "hsl(var(--secondary-foreground))",
        },
        destructive: {
          DEFAULT: "hsl(var(--destructive))",
          foreground: "hsl(var(--destructive-foreground))",
        },
        muted: {
          DEFAULT: "hsl(var(--muted))",
          foreground: "hsl(var(--muted-foreground))",
        },
        accent: {
          DEFAULT: "hsl(var(--accent))",
          foreground: "hsl(var(--accent-foreground))",
        },
        popover: {
          DEFAULT: "hsl(var(--popover))",
          foreground: "hsl(var(--popover-foreground))",
        },
        card: {
          DEFAULT: "hsl(var(--card))",
          foreground: "hsl(var(--card-foreground))",
        },
        // Legacy/Custom colors mapping to variables
        'page': 'var(--bg-page)',
        'layer-1': 'var(--bg-layer-1)',
        'layer-2': 'var(--bg-layer-2)',
        'layer-3': 'var(--bg-layer-3)',
        'glass': 'var(--bg-glass)',
        
        'content-primary': 'var(--text-primary)',
        'content-secondary': 'var(--text-secondary)',
        'content-tertiary': 'var(--text-tertiary)',
        'text-inverted': 'var(--text-inverted)',
        
        'border-subtle': 'var(--border-subtle)',
        'border-default': 'var(--border-default)',
        'border-strong': 'var(--border-strong)',
        'border-focus': 'var(--border-focus)',

        'primary-main': 'var(--primary-main)',
        'primary-hover': 'var(--primary-hover)',
        'primary-subtle': 'var(--primary-subtle)',
        'primary-text': 'var(--primary-text)',

        'status-error-bg': 'var(--status-error-bg)',
        'status-error-text': 'var(--status-error-text)',
        'status-success-bg': 'var(--status-success-bg)',
        'status-success-text': 'var(--status-success-text)',
        'status-warning-bg': 'var(--status-warning-bg)',
        'status-warning-text': 'var(--status-warning-text)',

        'message-user': 'var(--bg-message-user)',
        'message-ai': 'var(--bg-message-ai)',
        'input-main': 'var(--bg-input)',
        'input-sub': 'var(--bg-input-secondary)',
        'code-surface': 'var(--bg-code)',
        'code-text': 'var(--text-code)',
        'sidebar-surface': 'var(--bg-sidebar)',
      },
      borderRadius: {
        lg: "var(--radius)",
        md: "calc(var(--radius) - 2px)",
        sm: "calc(var(--radius) - 4px)",
      },
      keyframes: {
        "accordion-down": {
          from: { height: "0" },
          to: { height: "var(--radix-accordion-content-height)" },
        },
        "accordion-up": {
          from: { height: "var(--radix-accordion-content-height)" },
          to: { height: "0" },
        },
        'shimmer-wave': {
          '0%': { transform: 'translateX(-100%)' },
          '100%': { transform: 'translateX(100%)' },
        },
      },
      animation: {
        "accordion-down": "accordion-down 0.2s ease-out",
        "accordion-up": "accordion-up 0.2s ease-out",
        'shimmer-wave': 'shimmer-wave 2s infinite linear',
      },
      fontFamily: {
        sans: ['Inter', 'sans-serif'],
        mono: ['Fira Code', 'monospace'],
        display: ['Space Grotesk', 'sans-serif'],
      },
    },
  },
  plugins: [tailwindcssAnimate],
};

export default config;