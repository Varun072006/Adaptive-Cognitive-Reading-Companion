// ============================================================
// Content Script entry — mounts into the page
// ============================================================

import React, { useState, useEffect, useCallback, useRef } from 'react';
import ReactDOM from 'react-dom/client';
import { parseDom, cleanDom } from './DomParser';
import { StruggleDetector, StruggleEvent } from './StruggleDetector';
import { TTSEngine } from './TTSEngine';
import { GazeTracker } from './GazeTracker';
import ReaderOverlay from './ReaderOverlay';
import StrugglePopup from './StrugglePopup';
import { analyzeReadingLevel, ReadingLevelResult } from '../lib/ReadingLevel';
import { DEFAULT_PREFERENCES, Preferences } from '../lib/constants';
import './styles.css';

console.log('[ACRC] Content script pre-load');

/* ── URL blacklist — skip non-reading pages ─────────────── */

const SKIP_URL_PATTERNS = [
    /^https?:\/\/(www\.)?google\.[a-z.]+\/(search|maps|mail|calendar)/i,
    /^https?:\/\/(www\.)?bing\.com\/search/i,
    /^https?:\/\/(www\.)?duckduckgo\.com/i,
    /^https?:\/\/(www\.)?yahoo\.com\/search/i,
    /^https?:\/\/mail\./i,
    /^https?:\/\/(www\.)?(youtube|youtu\.be)/i,
    /^https?:\/\/(www\.)?(twitter|x)\.com/i,
    /^https?:\/\/(www\.)?facebook\.com/i,
    /^https?:\/\/(www\.)?instagram\.com/i,
    /^https?:\/\/(www\.)?reddit\.com/i,
    /^https?:\/\/(www\.)?github\.com/i,
    /^https?:\/\/(www\.)?docs\.google\.com/i,
    /^chrome(-extension)?:\/\//i,
    /^about:/i,
];

function shouldSkipPage(): boolean {
    const url = window.location.href;
    return SKIP_URL_PATTERNS.some(pattern => pattern.test(url));
}

/* ── Theme & Focus CSS injection ──────────────────────────── */

const BG_COLORS: Record<string, string> = {
    default: '',
    cream: '#FFF8E7',
    'light-blue': '#E8F4FD',
    'light-green': '#E8F5E9',
    dark: '#1a1a1a',
};

const ADS_SELECTORS = [
    '[class*="ad-"]', '[class*="sidebar"]', '[class*="banner"]',
    '[id*="ad-"]', '[id*="sidebar"]', 'aside',
    '[class*="promo"]', '[class*="sponsor"]', '.ad', '.ads',
    'iframe[src*="doubleclick"]', 'iframe[src*="googlesyndication"]',
];

/* ── Theme & Focus logic (Hydration-Safe Style Injection) ─── */

function applyTheme(prefs: Preferences) {
    const id = 'acrc-dynamic-theme';
    document.getElementById(id)?.remove();

    const bgColor = BG_COLORS[prefs.bgColor];
    let filterArr = [];
    if (prefs.darkMode && prefs.bgColor !== 'dark') filterArr.push('invert(0.9) hue-rotate(180deg)');
    if (prefs.highContrast) filterArr.push('contrast(1.4)');
    const filter = filterArr.length > 0 ? filterArr.join(' ') : 'none';

    const style = document.createElement('style');
    style.id = id;
    style.textContent = `
        html {
            ${prefs.fontSize !== 100 ? `font-size: ${prefs.fontSize}% !important;` : ''}
            ${prefs.font === 'dyslexic' ? 'font-family: "OpenDyslexic", "Comic Sans MS", cursive !important;' : ''}
            ${prefs.font === 'lexie' ? 'font-family: "Lexie Readable", "Verdana", sans-serif !important;' : ''}
            letter-spacing: ${prefs.letterSpacing}em !important;
            word-spacing: ${prefs.wordSpacing}em !important;
            line-height: ${prefs.lineHeight} !important;
            filter: ${filter} !important;
        }
        ${bgColor ? `body { background-color: ${bgColor} !important; ${prefs.bgColor === 'dark' ? 'color: #e0e0e0 !important;' : ''} }` : ''}
        ${prefs.darkMode ? 'html img, html video, html canvas { filter: invert(1) hue-rotate(180deg) !important; }' : ''}
    `;
    document.head.appendChild(style);
}

function clearTheme() {
    document.getElementById('acrc-dynamic-theme')?.remove();
    document.getElementById('acrc-hide-ads')?.remove();
    document.getElementById('acrc-para-isolation')?.remove();
}

function hideAds(enabled: boolean) {
    const id = 'acrc-hide-ads';
    document.getElementById(id)?.remove();
    if (!enabled) return;

    const style = document.createElement('style');
    style.id = id;
    style.textContent = ADS_SELECTORS.join(', ') + ' { display: none !important; visibility: hidden !important; height: 0 !important; overflow: hidden !important; }';
    document.head.appendChild(style);
}

function enableParagraphIsolation(enabled: boolean) {
    const id = 'acrc-para-isolation';
    document.getElementById(id)?.remove();
    if (!enabled) return;

    const style = document.createElement('style');
    style.id = id;
    style.textContent = `
        p, li, td, article p, main p, .content p {
            transition: opacity 0.3s ease, filter 0.3s ease !important;
            opacity: 0.25 !important;
            filter: blur(1.5px) !important;
        }
        p:hover, li:hover, td:hover, p.acrc-para-focus, li.acrc-para-focus, td.acrc-para-focus {
            opacity: 1 !important;
            filter: none !important;
        }
    `;
    document.head.appendChild(style);
    console.log('[ACRC] Paragraph isolation style injected');
}

/* ── Inject supplementary styles ──────────────────────────── */

function injectThemeStyles() {
    const id = 'acrc-theme-styles';
    if (document.getElementById(id)) return;

    const style = document.createElement('style');
    style.id = id;
    style.textContent = `
        .acrc-high-contrast {
            filter: contrast(1.4);
        }
        .acrc-dark-mode {
            filter: invert(0.9) hue-rotate(180deg);
        }
        .acrc-dark-mode img,
        .acrc-dark-mode video,
        .acrc-dark-mode canvas {
            filter: invert(1) hue-rotate(180deg);
        }
        .acrc-reading-level {
            position: fixed;
            bottom: 16px;
            right: 16px;
            z-index: 2147483640;
            padding: 6px 12px;
            border-radius: 20px;
            font-family: Inter, system-ui, sans-serif;
            font-size: 11px;
            font-weight: 600;
            box-shadow: 0 2px 12px rgba(0,0,0,0.3);
            pointer-events: auto;
            cursor: pointer;
            transition: all 0.3s ease;
        }
        .acrc-reading-level:hover {
            transform: scale(1.05);
        }
    `;
    document.head.appendChild(style);
}

/* ── Main App ─────────────────────────────────────────────── */

const App: React.FC = () => {
    const [prefs, setPrefs] = useState<Preferences>(DEFAULT_PREFERENCES);
    const [struggleEvent, setStruggleEvent] = useState<StruggleEvent | null>(null);
    const [showPopup, setShowPopup] = useState(false);
    const [showSoftSuggest, setShowSoftSuggest] = useState(false);
    const [readingLevel, setReadingLevel] = useState<ReadingLevelResult | null>(null);
    const [spokenCharIndex, setSpokenCharIndex] = useState(-1);
    const ttsRef = useRef<TTSEngine | null>(null);
    const detectorRef = useRef<StruggleDetector | null>(null);
    const gazeRef = useRef<GazeTracker | null>(null);

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
        chrome.storage.local.get('acrc_prefs', (data) => {
            if (data.acrc_prefs) {
                setPrefs({ ...DEFAULT_PREFERENCES, ...data.acrc_prefs });
            }
        });
        const listener = (changes: any) => {
            if (changes.acrc_prefs?.newValue) {
                setPrefs({ ...DEFAULT_PREFERENCES, ...changes.acrc_prefs.newValue });
            }
        };
        chrome.storage.onChanged.addListener(listener);
        return () => chrome.storage.onChanged.removeListener(listener);
    }, []);

    // Apply theme when prefs change
    useEffect(() => {
        if (!prefs.enabled) {
            clearTheme();
            cleanDom();
            return;
        }
        injectThemeStyles();
        applyTheme(prefs);
        hideAds(prefs.hideAds);
        enableParagraphIsolation(prefs.paragraphIsolation);

        return () => {
            clearTheme();
            cleanDom();
        };
    }, [prefs]);

    // Initialize DOM parser, struggle detector, TTS
    useEffect(() => {
        if (!prefs.enabled) return;

        console.log('[ACRC] Initializing features on:', window.location.hostname);

        const runParsing = () => {
            const wordCount = parseDom();
            wordCountRef.current = wordCount;
            console.log(`[ACRC] Parsed ${wordCount} words`);

            // Calculate reading level
            const bodyText = document.body.innerText || '';
            if (bodyText.length > 100) {
                setReadingLevel(analyzeReadingLevel(bodyText.substring(0, 10000)));
            }
        };

        // Use requestIdleCallback if available, or a short timeout
        if ('requestIdleCallback' in window) {
            (window as any).requestIdleCallback(() => runParsing());
        } else {
            setTimeout(runParsing, 500);
        }

        // MutationObserver for dynamic content (Wikipedia sidebars, lazy loads, SPAs)
        const observer = new MutationObserver((mutations) => {
            let shouldReparse = false;
            for (const mutation of mutations) {
                if (mutation.addedNodes.length > 0) {
                    // Only re-parse if significant text was added
                    shouldReparse = true;
                    break;
                }
            }
            if (shouldReparse) {
                // Debounce re-parsing
                const timer = (window as any).acrcParseTimer;
                if (timer) clearTimeout(timer);
                (window as any).acrcParseTimer = setTimeout(() => {
                    parseDom();
                }, 1000);
            }
        });

        observer.observe(document.body, { childList: true, subtree: true });

        // TTS engine
        ttsRef.current = new TTSEngine({
            rate: prefs.ttsRate,
            pitch: prefs.ttsPitch,
            voiceURI: prefs.ttsVoiceURI,
        });
        ttsRef.current.setOnWordBoundary((idx) => setSpokenCharIndex(idx));
        ttsRef.current.setOnEnd(() => setSpokenCharIndex(-1));

        // Click-to-speak
        const handleWordClick = (e: MouseEvent) => {
            const target = e.target as HTMLElement;
            if (target.classList?.contains('acrc-word') && ttsRef.current) {
                ttsRef.current.speakWord(target.textContent || '');
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
                        word: text.length > 30 ? text.substring(0, 30) + '...' : text, // Display a snippet as 'word'
                        element: null,
                        timestamp: Date.now(),
                        rect
                    });

                    setShowPopup(true);
                }
            }, 600);
        };
        document.addEventListener('selectionchange', handleSelectionChange);

        // Struggle detector (cursor dwell)
        if (prefs.struggleDetectionEnabled) {
            detectorRef.current = new StruggleDetector((event: StruggleEvent) => {
                setStruggleEvent(event);
                setShowSoftSuggest(true);
                setShowPopup(false); // Hide full popup initially

                // Report confused word to service worker for tracking
                if (event.word) {
                    confusedWordsRef.current.push(event.word);
                    try {
                        chrome.runtime.sendMessage({
                            type: 'CONFUSED_WORD',
                            word: event.word,
                        });
                    } catch { /* ignore */ }
                }
            });
            detectorRef.current.start();
        }

        // Gaze tracker (webcam eye tracking — only if user opted in)
        if (prefs.privacyCameraEnabled && prefs.struggleDetectionEnabled) {
            gazeRef.current = new GazeTracker({
                fixationThresholdMs: 3000,
                showGazeDot: true,
                showWebcam: true,
                onConfusion: (element, word) => {
                    setStruggleEvent({
                        type: 'stuck',
                        word,
                        element,
                        timestamp: Date.now(),
                    });
                    setShowSoftSuggest(true);
                    setShowPopup(false);
                },
            });
            gazeRef.current.start();
        }

        return () => {
            document.removeEventListener('click', handleWordClick);
            document.removeEventListener('selectionchange', handleSelectionChange);
            detectorRef.current?.stop();
            gazeRef.current?.stop();
            cleanDom();
        };
    }, [prefs.enabled, prefs.struggleDetectionEnabled, prefs.privacyCameraEnabled]);

    // Get the sentence containing the struggled word
    const getSentence = useCallback((): string => {
        if (!struggleEvent?.element) return struggleEvent?.word || '';
        const parent = struggleEvent.element.closest('p, div, li, td, h1, h2, h3, h4, h5, h6, span');
        return parent?.textContent?.trim() || struggleEvent.word;
    }, [struggleEvent]);

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
            <ReaderOverlay
                rulerEnabled={prefs.rulerEnabled}
                lineFocusEnabled={prefs.lineFocusEnabled}
                highlightOnHover={prefs.highlightOnHover}
                highlightColor={prefs.highlightColor}
            />

            {showSoftSuggest && struggleEvent && !showPopup && (
                <div
                    style={{
                        position: 'absolute',
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
                        gap: '6px'
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

            {showPopup && struggleEvent && (
                <StrugglePopup
                    word={struggleEvent.word}
                    sentence={struggleEvent.type === 'selection' ? window.getSelection()?.toString() || struggleEvent.word : getSentence()}
                    element={struggleEvent.element}
                    rect={struggleEvent.rect}
                    onDismiss={handleDismiss}
                    onDismissWord={handleDismissWord}
                    onSpeak={handleSpeak}
                    spokenCharIndex={spokenCharIndex}
                    defaultLevel={
                        readingLevel
                            ? (readingLevel.gradeLevel > 12 ? 3 : readingLevel.gradeLevel > 8 ? 2 : 1)
                            : prefs.simplificationLevel as (1 | 2 | 3)
                    }
                />
            )}

            {readingLevel && (
                <div
                    className="acrc-reading-level"
                    style={{ background: readingLevel.color, color: '#fff' }}
                    title={`Flesch-Kincaid Grade: ${readingLevel.gradeLevel}`}
                    onClick={() => {
                        if (readingLevel.suggestSimplify) {
                            // Optionally trigger something?
                        }
                    }}
                >
                    {readingLevel.difficulty} Reading
                </div>
            )}
        </>
    );
};

/* ── Mount into page (skip blacklisted URLs) ─────────────── */

if (!shouldSkipPage()) {
    const container = document.createElement('div');
    container.id = 'acrc-root';
    // Use fixed positioning so overlays (ruler, focus) work correctly across scroll
    container.style.cssText = 'position:fixed;top:0;left:0;width:100vw;height:100vh;z-index:2147483647;pointer-events:none;overflow:visible;';
    document.body.appendChild(container);

    const root = ReactDOM.createRoot(container);
    root.render(<App />);
}
