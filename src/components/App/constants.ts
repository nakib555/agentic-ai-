/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

// Default values for settings
export const DEFAULT_ABOUT_USER = '';
export const DEFAULT_ABOUT_RESPONSE = '';
export const DEFAULT_TEMPERATURE = 0.7;
export const DEFAULT_MAX_TOKENS = 0; // 0 or undefined means use model default
export const DEFAULT_TTS_VOICE = 'Kore';

export const TTS_VOICES = [
    // Standard Personas
    { id: 'Puck', name: 'Puck', desc: 'Energetic & Clear' },
    { id: 'Charon', name: 'Charon', desc: 'Deep & Authoritative' },
    { id: 'Kore', name: 'Kore', desc: 'Calm & Soothing' },
    { id: 'Fenrir', name: 'Fenrir', desc: 'Strong & Resonant' },
    { id: 'Zephyr', name: 'Zephyr', desc: 'Soft & Gentle' },
    
    // International Accents / Styles
    { id: 'British', name: 'British', desc: 'Native UK Speaker' },
    { id: 'American', name: 'American', desc: 'Native US Speaker' },
    { id: 'French', name: 'French', desc: 'Native Français' },
    { id: 'Japanese', name: 'Japanese', desc: 'Native Nihongo' },
    { id: 'Chinese', name: 'Chinese', desc: 'Native Mandarin' },
    { id: 'German', name: 'German', desc: 'Native Deutsch' },
    { id: 'Spanish', name: 'Spanish', desc: 'Native Español' },
    { id: 'Italian', name: 'Italian', desc: 'Native Italiano' },
    { id: 'Russian', name: 'Russian', desc: 'Native Русский' },
    { id: 'Bengali', name: 'Bengali', desc: 'Native Bengali' },
    { id: 'Indonesian', name: 'Indonesian', desc: 'Native Bahasa' },
];