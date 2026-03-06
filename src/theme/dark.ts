
/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

const darkTheme = {
  // --- Base Layers (Softer Standard Dark) ---
  "--bg-page": "#18181b",       // Zinc 900 (Softer than previous 950)
  "--bg-layer-1": "#27272a",    // Zinc 800
  "--bg-layer-2": "#3f3f46",    // Zinc 700
  "--bg-layer-3": "#52525b",    // Zinc 600
  "--bg-glass": "rgba(24, 24, 27, 0.85)",

  // --- Text Colors (Comfort Contrast) ---
  "--text-primary": "#f4f4f5",  // Zinc 100 (Off-white, less harsh than pure white)
  "--text-secondary": "#a1a1aa", // Zinc 400
  "--text-tertiary": "#71717a",  // Zinc 500
  "--text-inverted": "#000000",

  // --- Borders (Subtle) ---
  "--border-subtle": "rgba(255, 255, 255, 0.05)",
  "--border-default": "rgba(255, 255, 255, 0.1)",
  "--border-strong": "rgba(255, 255, 255, 0.2)",
  "--border-focus": "#818cf8",   // Indigo 400

  // --- Brand Colors (Balanced) ---
  "--primary-main": "#6366f1",   // Indigo 500
  "--primary-hover": "#818cf8",  // Indigo 400
  "--primary-subtle": "rgba(99, 102, 241, 0.15)",
  "--primary-text": "#e0e7ff",   // Indigo 50

  // --- Status Indicators (Muted) ---
  "--status-error-bg": "rgba(127, 29, 29, 0.2)", // Red 900/20
  "--status-error-text": "#fca5a5",              // Red 300
  "--status-success-bg": "rgba(20, 83, 45, 0.2)", // Green 900/20
  "--status-success-text": "#86efac",            // Green 300
  "--status-warning-bg": "rgba(113, 63, 18, 0.2)", // Yellow 900/20
  "--status-warning-text": "#fde047",            // Yellow 300

  // --- Component Specifics ---
  "--bg-message-user": "#27272a", // Zinc 800
  "--bg-message-ai": "transparent", 
  "--bg-input": "#27272a",        // Zinc 800
  "--bg-input-secondary": "#3f3f46", 
  "--bg-code": "#18181b",         // Match page bg for seamless code blocks
  "--text-code": "#e4e4e7",       // Zinc 200
  "--bg-sidebar": "#18181b"
};

export default darkTheme;
