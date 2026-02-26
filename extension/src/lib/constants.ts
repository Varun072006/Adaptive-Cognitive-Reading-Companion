export const EXTENSION_NAME = 'Adaptive Cognitive Reading Companion';

export const DEFAULT_PREFERENCES = {
    // Master toggle
    enabled: true,

    // Typography — always OpenDyslexia
    font: 'dyslexic' as 'system' | 'dyslexic',

    // Reading aids
    highlightOnHover: true,

    // AI / Struggle detection
    struggleDetectionEnabled: true,
    simplificationLevel: 2 as 1 | 2 | 3,

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
