// ============================================================
// Content Script entry — mounts into the page via Shadow DOM
// ============================================================

import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import ReactDOM from 'react-dom/client';
import { VirtualCursor, WordAtPoint } from './VirtualCursor';
import { StruggleDetector, StruggleEvent } from './StruggleDetector';
import { TTSEngine } from './TTSEngine';
import StrugglePopup from './StrugglePopup';
import { DEFAULT_PREFERENCES, Preferences } from '../lib/constants';
import contentStyles from './styles.css?inline';

console.log('[ACRC] Content script pre-load');

/* ── Chrome context guard — prevents errors after extension reload ── */

function isContextValid(): boolean {
    try {
        return !!chrome?.runtime?.id;
    } catch {
        return false;
    }
}

/* ── URL blacklist — skip non-reading pages ─────────────── */

const SKIP_URL_PATTERNS: RegExp[] = [];

function shouldSkipPage(): boolean {
    const url = window.location.href;
    return SKIP_URL_PATTERNS.some(pattern => pattern.test(url));
}

/* ── Font injection (OpenDyslexia into host page <head>) ── */

function applyFont(enabled: boolean, cursorColor: string = '#FF4A4A') {
    const id = 'acrc-dynamic-theme';
    document.getElementById(id)?.remove();
    if (!enabled) return;

    const encodedColor = encodeURIComponent(cursorColor);
    const style = document.createElement('style');
    style.id = id;
    style.textContent = `
        @font-face {
            font-family: 'OpenDyslexic';
            src: url('https://cdn.jsdelivr.net/npm/open-dyslexic@1.0.3/woff/OpenDyslexic-Regular.woff') format('woff');
            font-weight: 400;
            font-style: normal;
            font-display: swap;
        }
        @font-face {
            font-family: 'OpenDyslexic';
            src: url('https://cdn.jsdelivr.net/npm/open-dyslexic@1.0.3/woff/OpenDyslexic-Bold.woff') format('woff');
            font-weight: 700;
            font-style: normal;
            font-display: swap;
        }
        body, body * {
            font-family: "OpenDyslexic", "Comic Sans MS", cursive !important;
            cursor: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='48' height='48' viewBox='0 0 32 32'%3E%3Cpath d='M8 4l16 12-16 12V4z' fill='${encodedColor}' stroke='white' stroke-width='3'/%3E%3C/svg%3E") 8 4, auto !important;
        }
    `;
    document.head.appendChild(style);
}

function clearFont() {
    document.getElementById('acrc-dynamic-theme')?.remove();
}

/* ── Page background color (dyslexia-friendly overlays) ── */
/*
 * WORLD-CLASS DYSLEXIA THEMING — based on:
 *  - British Dyslexia Association (BDA) style guide
 *  - Irlen Syndrome / Scotopic Sensitivity research
 *  - W3C WCAG 2.1 contrast guidelines (AA minimum)
 *
 * Key principles:
 *  1. Override EVERY element's background — modern dark-mode sites
 *     set background on inner divs, not just html/body
 *  2. Use warm, slightly saturated tones — NOT pure white
 *  3. Bold text (600+) with generous spacing
 *  4. Soft but visible borders to maintain structure
 *  5. Links must be distinguishable by more than just color
 */

interface ThemePalette {
    hex: string;       // page background
    textColor: string; // body text
    linkColor: string; // links & accents
    borderClr: string; // card/section borders
    dividerClr: string;// strong lines (hr, table borders)
    inputBg: string;   // inputs, buttons, nav chips (slightly darker)
    hoverBg: string;   // hover/focus states
    headingClr: string;// headings (deeper tone)
    label: string;
    emoji: string;
}

const BG_COLORS: Record<string, ThemePalette> = {
    cream: {
        hex: '#FAF0DC', textColor: '#3B2F1E', linkColor: '#8B5E3C',
        borderClr: '#D4C4A8', dividerClr: '#B8A88C', inputBg: '#F0E6D0',
        hoverBg: '#E8DCC4', headingClr: '#2A1F0E',
        label: 'Cream', emoji: '🍦',
    },
    yellow: {
        hex: '#FFF9C4', textColor: '#3E3B10', linkColor: '#7D6608',
        borderClr: '#E0D68A', dividerClr: '#C4B86E', inputBg: '#F5EFB4',
        hoverBg: '#EBE5A0', headingClr: '#2E2B08',
        label: 'Yellow', emoji: '🌻',
    },
    blue: {
        hex: '#DCEEFB', textColor: '#1B2A3B', linkColor: '#1565C0',
        borderClr: '#A4C4E0', dividerClr: '#7BA3C7', inputBg: '#CEE3F5',
        hoverBg: '#BDD8EE', headingClr: '#0D1B2A',
        label: 'Blue', emoji: '💧',
    },
    green: {
        hex: '#DCEDC8', textColor: '#1B3409', linkColor: '#2E7D32',
        borderClr: '#A8C896', dividerClr: '#8BB87A', inputBg: '#D0E3BC',
        hoverBg: '#C2D9AE', headingClr: '#0F2204',
        label: 'Green', emoji: '🌿',
    },
    peach: {
        hex: '#FFE8CC', textColor: '#3B2510', linkColor: '#BF5B04',
        borderClr: '#E0C4A0', dividerClr: '#C8A880', inputBg: '#F5DDC0',
        hoverBg: '#EBD2B4', headingClr: '#2A1808',
        label: 'Peach', emoji: '🍑',
    },
    grey: {
        hex: '#ECEFF1', textColor: '#263238', linkColor: '#37474F',
        borderClr: '#B0BEC5', dividerClr: '#90A4AE', inputBg: '#E0E5E8',
        hoverBg: '#D4DBDF', headingClr: '#1A2328',
        label: 'Grey', emoji: '🌫️',
    },
};

function applyPageBg(color: string) {
    const id = 'acrc-page-bg';
    document.getElementById(id)?.remove();
    if (color === 'none' || !BG_COLORS[color]) return;

    const t = BG_COLORS[color]; // full palette

    const style = document.createElement('style');
    style.id = id;
    style.textContent = `
        /* ══════ UNIVERSAL THEME — works on dark AND light sites ══════ */

        /* ── Base: override every element's background ── */
        html, body,
        body *:not(#acrc-host):not(#acrc-host *)
              :not(img):not(video):not(canvas):not(iframe)
              :not(svg):not(svg *):not(picture):not(source)
              :not([data-testid*="calendar"]):not([class*="contrib"])
              :not([class*="chart"]):not([class*="graph"]):not([class*="heatmap"])
              :not([class*="activity"]):not([class*="avatar"]):not([class*="Avatar"])
              :not([class*="thumbnail"]):not([class*="Thumbnail"])
              :not([class*="player"]):not([class*="Player"]) {
            background-color: ${t.hex} !important;
            background-image: none !important;
            color: ${t.textColor} !important;
        }

        /* ── Typography: bold, spacious, easy to track ── */
        body *:not(#acrc-host):not(#acrc-host *)
              :not([class*="icon"]):not([class*="Icon"])
              :not([class*="material"]):not([class*="Material"])
              :not([class*="fa-"]):not([class*="bi-"]):not([class*="ri-"])
              :not([class*="emoji"]) {
            font-weight: 600 !important;
            letter-spacing: 0.035em !important;
            line-height: 1.8 !important;
            word-spacing: 0.1em !important;
        }

        /* ── BORDERS: clearly visible structural lines ── */
        body *:not(#acrc-host):not(#acrc-host *)
              :not(img):not(video):not(canvas):not(iframe)
              :not(svg):not(svg *) {
            border-color: ${t.borderClr} !important;
        }

        /* ── Navigation: chips, pills, tabs, sidebars ── 
         * These get a slightly darker bg so they look like buttons */
        body nav:not(#acrc-host *),
        body [role="navigation"]:not(#acrc-host *),
        body [role="toolbar"]:not(#acrc-host *),
        body [role="tablist"]:not(#acrc-host *),
        body [role="tab"]:not(#acrc-host *),
        body [role="menubar"]:not(#acrc-host *),
        body [role="menu"]:not(#acrc-host *),
        body [class*="chip"]:not(#acrc-host *),
        body [class*="Chip"]:not(#acrc-host *),
        body [class*="pill"]:not(#acrc-host *),
        body [class*="tab"]:not(#acrc-host *):not(table):not(td):not(th),
        body [class*="Tab"]:not(#acrc-host *):not(table):not(td):not(th),
        body [class*="nav"]:not(#acrc-host *):not(canvas),
        body [class*="Nav"]:not(#acrc-host *),
        body [class*="sidebar"]:not(#acrc-host *),
        body [class*="Sidebar"]:not(#acrc-host *),
        body [class*="menu"]:not(#acrc-host *),
        body [class*="Menu"]:not(#acrc-host *),
        body [class*="header"]:not(#acrc-host *),
        body [class*="Header"]:not(#acrc-host *),
        body [class*="toolbar"]:not(#acrc-host *),
        body [class*="Toolbar"]:not(#acrc-host *),
        body header:not(#acrc-host *),
        body footer:not(#acrc-host *) {
            background-color: ${t.inputBg} !important;
            border-bottom: 1.5px solid ${t.borderClr} !important;
        }

        /* ── Buttons & interactive chips: clearly clickable ── */
        body button:not(#acrc-host *),
        body input:not(#acrc-host *),
        body textarea:not(#acrc-host *),
        body select:not(#acrc-host *),
        body [role="button"]:not(#acrc-host *),
        body [class*="btn"]:not(#acrc-host *),
        body [class*="Btn"]:not(#acrc-host *),
        body [class*="button"]:not(#acrc-host *),
        body [class*="Button"]:not(#acrc-host *) {
            background-color: ${t.inputBg} !important;
            border: 2px solid ${t.borderClr} !important;
            border-radius: 6px !important;
            color: ${t.textColor} !important;
        }
        body button:not(#acrc-host *):hover,
        body [role="button"]:not(#acrc-host *):hover,
        body input:not(#acrc-host *):focus,
        body textarea:not(#acrc-host *):focus {
            background-color: ${t.hoverBg} !important;
            outline: 2.5px solid ${t.linkColor} !important;
            outline-offset: 2px !important;
        }

        /* ── Tables: visible cell borders ── */
        body table:not(#acrc-host *) {
            border-collapse: collapse !important;
            border: 2px solid ${t.dividerClr} !important;
        }
        body th:not(#acrc-host *), body td:not(#acrc-host *) {
            border: 1.5px solid ${t.borderClr} !important;
            padding: 8px 12px !important;
        }
        body th:not(#acrc-host *) {
            background-color: ${t.hoverBg} !important;
            font-weight: 800 !important;
        }
        body tr:not(#acrc-host *):nth-child(even) {
            background-color: ${t.inputBg} !important;
        }

        /* ── Horizontal rules: thick dividers ── */
        body hr:not(#acrc-host *) {
            border: none !important;
            height: 3px !important;
            background-color: ${t.dividerClr} !important;
            margin: 16px 0 !important;
        }

        /* ── Cards & sections: visible edges ── */
        body article:not(#acrc-host *),
        body section:not(#acrc-host *),
        body aside:not(#acrc-host *),
        body details:not(#acrc-host *),
        body [class*="card"]:not(#acrc-host *),
        body [class*="Card"]:not(#acrc-host *),
        body [class*="repo"]:not(#acrc-host *),
        body [class*="Box-"]:not(#acrc-host *),
        body [role="listitem"]:not(#acrc-host *) {
            border: 1.5px solid ${t.borderClr} !important;
            border-radius: 8px !important;
        }

        /* ── Lists: visible markers ── */
        body li:not(#acrc-host *)::marker {
            color: ${t.linkColor} !important;
            font-weight: 800 !important;
        }

        /* ── Links: ONLY underline content links, NOT nav links ── */
        body a:not(#acrc-host *) {
            color: ${t.linkColor} !important;
            font-weight: 700 !important;
        }
        /* Content links — inside readable areas — get thick underlines */
        body p a:not(#acrc-host *),
        body article a:not(#acrc-host *),
        body .content a:not(#acrc-host *),
        body [role="main"] a:not(#acrc-host *),
        body main a:not(#acrc-host *),
        body li a:not(#acrc-host *),
        body td a:not(#acrc-host *),
        body blockquote a:not(#acrc-host *),
        body .wiki a:not(#acrc-host *),
        body #mw-content-text a:not(#acrc-host *),
        body .mw-parser-output a:not(#acrc-host *) {
            text-decoration: underline !important;
            text-decoration-color: ${t.linkColor} !important;
            text-decoration-thickness: 2.5px !important;
            text-underline-offset: 4px !important;
        }
        /* Nav links: NO underline, just color + bold */
        body nav a:not(#acrc-host *),
        body header a:not(#acrc-host *),
        body [role="navigation"] a:not(#acrc-host *),
        body [class*="nav"] a:not(#acrc-host *),
        body [class*="Nav"] a:not(#acrc-host *),
        body [class*="sidebar"] a:not(#acrc-host *),
        body [class*="menu"] a:not(#acrc-host *),
        body [class*="Menu"] a:not(#acrc-host *) {
            text-decoration: none !important;
        }

        /* ── Headings: extra bold with bottom border ── */
        body h1:not(#acrc-host *), body h2:not(#acrc-host *),
        body h3:not(#acrc-host *), body h4:not(#acrc-host *),
        body h5:not(#acrc-host *), body h6:not(#acrc-host *) {
            color: ${t.headingClr} !important;
            font-weight: 800 !important;
            letter-spacing: 0.04em !important;
            line-height: 1.5 !important;
            border-bottom: 2px solid ${t.borderClr} !important;
            padding-bottom: 6px !important;
            margin-bottom: 12px !important;
        }

        /* ── Code blocks: recessed look ── */
        body code:not(#acrc-host *), body pre:not(#acrc-host *),
        body kbd:not(#acrc-host *), body samp:not(#acrc-host *) {
            font-weight: 500 !important;
            letter-spacing: 0.02em !important;
            background-color: ${t.inputBg} !important;
            border: 1.5px solid ${t.borderClr} !important;
            border-radius: 4px !important;
        }

        /* ── Selection highlight ── */
        ::selection {
            background-color: ${t.linkColor} !important;
            color: white !important;
        }

        /* ── Remove visual noise (but keep on SVGs/media) ── */
        body *:not(#acrc-host):not(#acrc-host *)
              :not(svg):not(svg *):not(canvas):not(img):not(video):not(button) {
            box-shadow: none !important;
            text-shadow: none !important;
        }

        /* ══════ PRESERVE: media, icons, data-viz ══════ */
        body img, body video, body canvas,
        body svg, body svg *,
        body iframe, body picture, body source, body audio,
        body [class*="icon"], body [class*="Icon"],
        body [class*="emoji"], body [class*="Emoji"],
        body [data-testid*="calendar"], body [data-testid*="calendar"] *,
        body [class*="contrib"], body [class*="contrib"] *,
        body [class*="chart"], body [class*="chart"] *,
        body [class*="graph"], body [class*="graph"] *,
        body [class*="heatmap"], body [class*="heatmap"] *,
        body [class*="activity"], body [class*="activity"] *,
        body [class*="avatar"], body [class*="avatar"] *,
        body [class*="Avatar"], body [class*="Avatar"] *,
        body [class*="calendar"], body [class*="calendar"] *,
        body [class*="thumbnail"], body [class*="thumbnail"] *,
        body [class*="Thumbnail"], body [class*="Thumbnail"] *,
        body [class*="player"], body [class*="player"] *,
        body [class*="Player"], body [class*="Player"] *,
        body [class*="badge"], body [class*="Badge"],
        body [class*="logo"], body [class*="Logo"] {
            color: initial !important;
            background-color: initial !important;
            background-image: initial !important;
            font-weight: initial !important;
            letter-spacing: initial !important;
            line-height: initial !important;
            word-spacing: initial !important;
            border-color: initial !important;
            box-shadow: initial !important;
        }

        /* ══════ Preserve ACRC extension UI ══════ */
        #acrc-host, #acrc-host * {
            all: initial;
            color: initial !important;
            background-color: initial !important;
            background-image: initial !important;
            font-weight: initial !important;
            letter-spacing: initial !important;
            line-height: initial !important;
            word-spacing: initial !important;
            border-color: initial !important;
            box-shadow: initial !important;
        }

        /* ── Scrollbar ── */
        ::-webkit-scrollbar { width: 14px !important; }
        ::-webkit-scrollbar-track { background: ${t.hex} !important; }
        ::-webkit-scrollbar-thumb {
            background: ${t.borderClr} !important;
            border-radius: 7px !important;
            border: 3px solid ${t.hex} !important;
        }
    `;
    document.head.appendChild(style);
}

/* Utility: darken/lighten a hex color by a percentage */
function adjustBrightness(hex: string, percent: number): string {
    const num = parseInt(hex.replace('#', ''), 16);
    const r = Math.min(255, Math.max(0, ((num >> 16) & 0xFF) + Math.round(2.55 * percent)));
    const g = Math.min(255, Math.max(0, ((num >> 8) & 0xFF) + Math.round(2.55 * percent)));
    const b = Math.min(255, Math.max(0, (num & 0xFF) + Math.round(2.55 * percent)));
    return `#${(r << 16 | g << 8 | b).toString(16).padStart(6, '0')}`;
}

function clearPageBg() {
    document.getElementById('acrc-page-bg')?.remove();
}

/* ── Main App ─────────────────────────────────────────────── */

const App: React.FC<{ shadowContainer: HTMLElement }> = ({ shadowContainer }) => {
    const [prefs, setPrefs] = useState<Preferences>(DEFAULT_PREFERENCES);
    const [struggleEvent, setStruggleEvent] = useState<StruggleEvent | null>(null);
    const [showPopup, setShowPopup] = useState(false);
    const [showSoftSuggest, setShowSoftSuggest] = useState(false);
    const [spokenCharIndex, setSpokenCharIndex] = useState(-1);
    const [toolbarCollapsed, setToolbarCollapsed] = useState(false);
    const ttsRef = useRef<TTSEngine | null>(null);
    const detectorRef = useRef<StruggleDetector | null>(null);
    const virtualCursorRef = useRef<VirtualCursor | null>(null);
    const showPopupRef = useRef(false);

    // Sync ref with state for the struggle detector callback
    useEffect(() => {
        showPopupRef.current = showPopup;
    }, [showPopup]);

    // Session tracking refs
    const sessionStartRef = useRef<number>(Date.now());
    const wordCountRef = useRef<number>(0);
    const confusedWordsRef = useRef<string[]>([]);

    // Send session data to service worker on page unload
    useEffect(() => {
        const sendSessionEnd = () => {
            if (!prefs.enabled || wordCountRef.current === 0) return;
            try {
                chrome.runtime.sendMessage({
                    type: 'SESSION_END',
                    session: {
                        url: window.location.href,
                        title: document.title,
                        startTime: sessionStartRef.current,
                        endTime: Date.now(),
                        wordsRead: wordCountRef.current,
                        confusedWords: confusedWordsRef.current,
                        date: new Date().toISOString().slice(0, 10),
                    },
                });
            } catch { /* extension context may be invalidated */ }
        };

        window.addEventListener('beforeunload', sendSessionEnd);
        return () => {
            sendSessionEnd();
            window.removeEventListener('beforeunload', sendSessionEnd);
        };
    }, [prefs.enabled]);

    // Load prefs from storage & listen for changes
    useEffect(() => {
        if (!isContextValid()) return;
        try {
            chrome.storage.local.get('acrc_prefs', (data: any) => {
                if (data.acrc_prefs) {
                    // Strip old keys that no longer exist in DEFAULT_PREFERENCES
                    const cleaned: any = {};
                    for (const key of Object.keys(DEFAULT_PREFERENCES)) {
                        cleaned[key] = data.acrc_prefs[key] ?? (DEFAULT_PREFERENCES as any)[key];
                    }
                    setPrefs(cleaned);
                    // Persist the cleaned version
                    chrome.storage.local.set({ acrc_prefs: cleaned });
                }
            });
            const listener = (changes: any) => {
                if (changes.acrc_prefs?.newValue) {
                    setPrefs({ ...DEFAULT_PREFERENCES, ...changes.acrc_prefs.newValue });
                }
            };
            chrome.storage.onChanged.addListener(listener);
            return () => chrome.storage.onChanged.removeListener(listener);
        } catch {
            console.warn('[ACRC] Extension context lost — refresh the page to reconnect.');
        }
    }, []);

    // Apply OpenDyslexia font when prefs change
    useEffect(() => {
        if (!prefs.enabled) {
            clearFont();
            return;
        }
        // Pick cursor color based on theme
        const cursorColorMap: Record<string, string> = {
            none: '#FF4A4A',
            cream: '#8B6914',
            yellow: '#9E8C1A',
            blue: '#1A5276',
            green: '#1B5E20',
            peach: '#BF6B2A',
            grey: '#455A64',
        };
        const cursorColor = cursorColorMap[prefs.pageBgColor] || '#FF4A4A';
        applyFont(true, cursorColor);

        return () => {
            clearFont();
        };
    }, [prefs.enabled, prefs.pageBgColor]);

    // Compute popup theme from selected background color
    const popupTheme = useMemo(() => {
        const c = prefs.pageBgColor;
        if (c === 'none' || !BG_COLORS[c]) {
            return undefined; // use StrugglePopup default
        }
        const { hex, textColor, linkColor } = BG_COLORS[c];
        // Accent color per theme
        const accentMap: Record<string, string> = {
            cream: '#8B6914',
            yellow: '#9E8C1A',
            blue: '#1A5276',
            green: '#2E7D32',
            peach: '#BF6B2A',
            grey: '#455A64',
        };
        return {
            bg: hex,
            text: textColor,
            link: linkColor,
            accent: accentMap[c] || '#4A90D9',
            subtleBg: 'rgba(0,0,0,0.04)',
            borderColor: 'rgba(0,0,0,0.1)',
        };
    }, [prefs.pageBgColor]);

    // Apply dyslexia-friendly page background color
    useEffect(() => {
        if (!prefs.enabled) {
            clearPageBg();
            return;
        }
        applyPageBg(prefs.pageBgColor);

        return () => {
            clearPageBg();
        };
    }, [prefs.enabled, prefs.pageBgColor]);

    // Helper to update pageBgColor pref in storage
    const setPageBg = useCallback((color: string) => {
        const updated = { ...prefs, pageBgColor: color };
        // Apply locally immediately (works even if context is gone)
        setPrefs(updated as Preferences);
        applyPageBg(color);
        // Persist to storage if context is still alive
        try {
            if (isContextValid()) {
                chrome.storage.local.set({ acrc_prefs: updated });
            }
        } catch {
            console.warn('[ACRC] Extension context lost — color applied locally. Refresh to persist.');
        }
    }, [prefs]);

    // Listen for popup tool button actions
    useEffect(() => {
        const handleMessage = (msg: any, _sender: any, sendResponse: (response?: any) => void) => {
            if (msg.type !== 'ACRC_ACTION') return false;

            const selection = window.getSelection();
            const text = selection?.toString().trim() || '';

            if (!text || text.length < 2) {
                sendResponse({ message: '⚠️ Select some text on the page first' });
                return true;
            }

            // Create a struggle event for the selected text
            const range = selection!.getRangeAt(0);
            const rect = range.getBoundingClientRect();

            setStruggleEvent({
                type: 'selection',
                word: text.length > 30 ? text.substring(0, 30) + '...' : text,
                element: null,
                timestamp: Date.now(),
                rect,
                sentence: text,
                context: text,
            });

            setShowPopup(true);
            setShowSoftSuggest(false);
            sendResponse({ message: `✅ Opening ${msg.action} for selected text` });
            return true;
        };

        chrome.runtime.onMessage.addListener(handleMessage);
        return () => chrome.runtime.onMessage.removeListener(handleMessage);
    }, []);

    // Initialize Virtual Cursor, struggle detector, TTS
    useEffect(() => {
        if (!prefs.enabled) return;

        console.log('[ACRC] Initializing features on:', window.location.hostname);

        // Virtual Cursor — no DOM modification
        const vc = new VirtualCursor('#4A90D9');
        virtualCursorRef.current = vc;

        // Estimate word count without modifying DOM
        const runEstimate = () => {
            const wordCount = VirtualCursor.estimateWordCount();
            wordCountRef.current = wordCount;
            console.log(`[ACRC] Estimated ${wordCount} words (zero-DOM-mutation)`);
        };

        if ('requestIdleCallback' in window) {
            (window as any).requestIdleCallback(() => runEstimate());
        } else {
            setTimeout(runEstimate, 500);
        }

        // Word highlight on hover — bold + enlarge
        const handleMouseMoveHighlight = (e: MouseEvent) => {
            const wordInfo = vc.getWordAtPoint(e.clientX, e.clientY);
            if (wordInfo) {
                vc.showHighlight(wordInfo.rect, shadowContainer, wordInfo.word);
            } else {
                vc.hideHighlight();
            }
        };
        document.addEventListener('mousemove', handleMouseMoveHighlight);

        // TTS engine
        ttsRef.current = new TTSEngine({
            rate: prefs.ttsRate,
            pitch: prefs.ttsPitch,
            voiceURI: prefs.ttsVoiceURI,
        });
        ttsRef.current.setOnWordBoundary((idx: number) => setSpokenCharIndex(idx));
        ttsRef.current.setOnEnd(() => setSpokenCharIndex(-1));

        // Click-to-speak using VirtualCursor
        const handleWordClick = (e: MouseEvent) => {
            const wordInfo = vc.getWordAtPoint(e.clientX, e.clientY);
            if (wordInfo && ttsRef.current) {
                ttsRef.current.speakWord(wordInfo.word);
            }
        };
        document.addEventListener('click', handleWordClick);

        // Text selection detection
        let selectionTimeout: ReturnType<typeof setTimeout> | null = null;
        const handleSelectionChange = () => {
            if (selectionTimeout) clearTimeout(selectionTimeout);
            selectionTimeout = setTimeout(() => {
                const selection = window.getSelection();
                if (!selection || selection.isCollapsed) return;

                const text = selection.toString().trim();
                if (text.length > 5 && text.split(/\s+/).length <= 200) {
                    const range = selection.getRangeAt(0);
                    const rect = range.getBoundingClientRect();

                    setStruggleEvent({
                        type: 'selection',
                        word: text.length > 30 ? text.substring(0, 30) + '...' : text,
                        element: null,
                        timestamp: Date.now(),
                        rect,
                        sentence: text,
                        context: text,
                    });

                    setShowPopup(true);
                }
            }, 600);
        };
        document.addEventListener('selectionchange', handleSelectionChange);

        // Struggle detector (uses VirtualCursor internally)
        if (prefs.struggleDetectionEnabled) {
            detectorRef.current = new StruggleDetector((event: StruggleEvent) => {
                // If the user already has the full popup open, don't interrupt them
                if (showPopupRef.current) return;

                setStruggleEvent(event);
                setShowSoftSuggest(true);

                if (event.word) {
                    confusedWordsRef.current.push(event.word);
                    if (isContextValid()) {
                        try {
                            chrome.runtime.sendMessage({
                                type: 'CONFUSED_WORD',
                                word: event.word,
                            });
                        } catch { /* ignore */ }
                    }
                }
            }, vc);
            detectorRef.current.start();
        }

        return () => {
            document.removeEventListener('mousemove', handleMouseMoveHighlight);
            document.removeEventListener('click', handleWordClick);
            document.removeEventListener('selectionchange', handleSelectionChange);
            detectorRef.current?.stop();
            vc.destroy();
        };
    }, [prefs.enabled, prefs.struggleDetectionEnabled]);

    // Get the sentence containing the struggled word
    const getSentence = useCallback((): string => {
        return struggleEvent?.sentence || struggleEvent?.word || '';
    }, [struggleEvent]);

    // Get the context (current + preceding sentences) for AI
    const getContext = useCallback((): string => {
        return struggleEvent?.context || getSentence();
    }, [struggleEvent, getSentence]);

    const handleDismiss = useCallback(() => {
        setShowPopup(false);
        setShowSoftSuggest(false);
        setStruggleEvent(null);
    }, []);

    const handleDismissWord = useCallback(
        (word: string) => {
            detectorRef.current?.dismissWord(word);
            handleDismiss();
        },
        [handleDismiss]
    );

    const handleSpeak = useCallback((text: string, rate: number = prefs.ttsRate) => {
        if (ttsRef.current) {
            ttsRef.current.setOptions({ rate, pitch: prefs.ttsPitch, voiceURI: prefs.ttsVoiceURI });
            ttsRef.current.speakText(text);
        }
    }, [prefs.ttsRate, prefs.ttsPitch, prefs.ttsVoiceURI]);

    if (!prefs.enabled) return null;

    return (
        <>
            {/* ── Dyslexia-friendly background color toolbar ────── */}
            <div
                className="acrc-color-toolbar"
                style={{
                    position: 'fixed',
                    top: 0,
                    left: 0,
                    width: '100%',
                    zIndex: 2147483646,
                    pointerEvents: 'auto',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: toolbarCollapsed ? '0px' : '8px',
                    padding: toolbarCollapsed ? '2px 8px' : '6px 16px',
                    background: 'linear-gradient(135deg, rgba(15,12,41,0.92) 0%, rgba(26,26,46,0.95) 100%)',
                    backdropFilter: 'blur(12px)',
                    borderBottom: '1px solid rgba(74,144,217,0.25)',
                    transition: 'all 0.3s cubic-bezier(0.4,0,0.2,1)',
                    overflow: 'hidden',
                    maxHeight: toolbarCollapsed ? '24px' : '48px',
                    fontFamily: "'OpenDyslexic', 'Comic Sans MS', cursive",
                }}
            >
                {!toolbarCollapsed && (
                    <>
                        <span style={{ fontSize: '10px', color: 'rgba(255,255,255,0.6)', fontWeight: 600, marginRight: '4px', whiteSpace: 'nowrap' }}>
                            🎨 BG
                        </span>
                        {Object.entries(BG_COLORS).map(([key, { hex, label, emoji }]) => (
                            <button
                                key={key}
                                title={label}
                                onClick={() => setPageBg(key)}
                                className="acrc-color-swatch"
                                style={{
                                    width: '26px',
                                    height: '26px',
                                    borderRadius: '50%',
                                    backgroundColor: hex,
                                    border: prefs.pageBgColor === key
                                        ? '3px solid #4A90D9'
                                        : '2px solid rgba(255,255,255,0.25)',
                                    cursor: 'pointer',
                                    transition: 'all 0.2s ease',
                                    boxShadow: prefs.pageBgColor === key
                                        ? '0 0 8px rgba(74,144,217,0.6)'
                                        : '0 1px 3px rgba(0,0,0,0.3)',
                                    transform: prefs.pageBgColor === key ? 'scale(1.15)' : 'scale(1)',
                                    flexShrink: 0,
                                    padding: 0,
                                }}
                            />
                        ))}
                        {prefs.pageBgColor !== 'none' && (
                            <button
                                title="Reset to original"
                                onClick={() => setPageBg('none')}
                                style={{
                                    background: 'rgba(255,255,255,0.1)',
                                    border: '1px solid rgba(255,255,255,0.2)',
                                    color: 'rgba(255,255,255,0.7)',
                                    borderRadius: '12px',
                                    padding: '3px 10px',
                                    fontSize: '10px',
                                    cursor: 'pointer',
                                    fontWeight: 700,
                                    fontFamily: "'OpenDyslexic', 'Comic Sans MS', cursive",
                                    transition: 'all 0.2s ease',
                                    whiteSpace: 'nowrap',
                                    flexShrink: 0,
                                }}
                            >
                                ✕ Reset
                            </button>
                        )}
                    </>
                )}
                <button
                    title={toolbarCollapsed ? 'Expand color bar' : 'Collapse color bar'}
                    onClick={() => setToolbarCollapsed(!toolbarCollapsed)}
                    style={{
                        background: 'none',
                        border: 'none',
                        color: 'rgba(255,255,255,0.5)',
                        cursor: 'pointer',
                        fontSize: '12px',
                        padding: '0 4px',
                        transition: 'transform 0.3s ease',
                        transform: toolbarCollapsed ? 'rotate(180deg)' : 'rotate(0deg)',
                        flexShrink: 0,
                    }}
                >
                    ▲
                </button>
            </div>
            {/* Soft suggest bubble — appears on struggle */}
            {showSoftSuggest && struggleEvent && !showPopup && (
                <div
                    className="acrc-tab"
                    style={{
                        position: 'fixed',
                        top: struggleEvent.rect ? struggleEvent.rect.bottom + 8 : (struggleEvent.element?.getBoundingClientRect().bottom || 0) + 8,
                        left: Math.max(8, struggleEvent.rect ? struggleEvent.rect.left : (struggleEvent.element?.getBoundingClientRect().left || 0)),
                        background: 'linear-gradient(135deg, #4A90D9 0%, #7B68EE 100%)',
                        color: 'white',
                        padding: '8px 16px',
                        borderRadius: '20px',
                        fontSize: '12px',
                        fontWeight: 600,
                        cursor: 'pointer',
                        boxShadow: '0 4px 12px rgba(0,0,0,0.3)',
                        zIndex: 2147483646,
                        animation: 'acrc-slide-up 0.2s ease-out',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '6px',
                        backdropFilter: 'blur(12px)',
                        pointerEvents: 'auto',
                        fontFamily: "'OpenDyslexic', 'Comic Sans MS', cursive"
                    }}
                    onClick={() => {
                        setShowSoftSuggest(false);
                        setShowPopup(true);
                    }}
                >
                    <span>💡</span> Need help understanding this?
                    <button
                        onClick={(e) => { e.stopPropagation(); handleDismiss(); }}
                        style={{ background: 'none', border: 'none', color: 'rgba(255,255,255,0.7)', cursor: 'pointer', marginLeft: '4px' }}
                    >✕</button>
                </div>
            )}

            {/* Full struggle popup — with all AI features */}
            {showPopup && struggleEvent && (
                <StrugglePopup
                    word={struggleEvent.word}
                    sentence={struggleEvent.type === 'selection' ? window.getSelection()?.toString() || struggleEvent.word : getSentence()}
                    context={getContext()}
                    element={struggleEvent.element}
                    rect={struggleEvent.rect}
                    onDismiss={handleDismiss}
                    onDismissWord={handleDismissWord}
                    onSpeak={handleSpeak}
                    spokenCharIndex={spokenCharIndex}
                    defaultLevel={prefs.simplificationLevel as (1 | 2 | 3)}
                    theme={popupTheme}
                />
            )}
        </>
    );
};

/* ── Mount into Shadow DOM (skip blacklisted URLs) ────────── */

if (!shouldSkipPage()) {
    const host = document.createElement('div');
    host.id = 'acrc-host';
    host.style.cssText = 'position:fixed;top:0;left:0;width:0;height:0;z-index:2147483647;pointer-events:none;overflow:visible;';
    document.body.appendChild(host);

    // Shadow DOM — isolates extension UI from host CSS
    const shadow = host.attachShadow({ mode: 'open' });

    // Inject extension styles into shadow root
    const style = document.createElement('style');
    style.textContent = contentStyles + `
        :host {
            all: initial;
            position: fixed;
            top: 0;
            left: 0;
            width: 100vw;
            height: 100vh;
            z-index: 2147483647;
            pointer-events: none;
            overflow: visible;
            font-family: "OpenDyslexic", "Comic Sans MS", cursive !important;
        }
        * {
            box-sizing: border-box;
        }
    `;
    shadow.appendChild(style);

    const container = document.createElement('div');
    container.id = 'acrc-root';
    container.style.cssText = 'position:fixed;top:0;left:0;width:100vw;height:100vh;pointer-events:none;overflow:visible;';
    shadow.appendChild(container);

    const root = ReactDOM.createRoot(container);
    root.render(<App shadowContainer={container} />);
}
