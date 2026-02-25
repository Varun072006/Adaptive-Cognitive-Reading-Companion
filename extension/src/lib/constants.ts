export const EXTENSION_NAME = 'Adaptive Cognitive Reading Companion';

export const DEFAULT_PREFERENCES = {
    // Master toggle
    enabled: true,

    // Typography
    font: 'system' as 'system' | 'dyslexic' | 'lexie',
    fontSize: 100,             // percentage (100 = normal)
    letterSpacing: 0.05,       // em
    wordSpacing: 0.1,          // em
    lineHeight: 1.8,

    // Visual themes
    highlightColor: '#4A90D9',
    highContrast: false,
    darkMode: false,
    bgColor: 'default' as 'default' | 'cream' | 'light-blue' | 'light-green' | 'dark',

    // Reading aids
    rulerEnabled: true,
    lineFocusEnabled: false,
    highlightOnHover: true,
    paragraphIsolation: false,
    hideAds: false,

    // AI
    struggleDetectionEnabled: true,
    simplificationLevel: 2 as 1 | 2 | 3, // default simplification level

    // TTS
    ttsRate: 0.9,
    ttsPitch: 1.0,
    ttsVoiceURI: null as string | null,

    // Privacy
    privacyAIEnabled: true,
    privacyCameraEnabled: false,
    privacyLogsEnabled: true,
};

export type Preferences = typeof DEFAULT_PREFERENCES;
