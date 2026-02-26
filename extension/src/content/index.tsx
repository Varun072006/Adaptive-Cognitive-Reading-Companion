// ============================================================
// Content Script entry — mounts into the page via Shadow DOM
// ============================================================

import React, { useState, useEffect, useCallback, useRef } from 'react';
import ReactDOM from 'react-dom/client';
import { VirtualCursor, WordAtPoint } from './VirtualCursor';
import { StruggleDetector, StruggleEvent } from './StruggleDetector';
import { TTSEngine } from './TTSEngine';
import StrugglePopup from './StrugglePopup';
import { DEFAULT_PREFERENCES, Preferences } from '../lib/constants';
import contentStyles from './styles.css?inline';

console.log('[ACRC] Content script pre-load');

/* ── URL blacklist — skip non-reading pages ─────────────── */

const SKIP_URL_PATTERNS: RegExp[] = [];

function shouldSkipPage(): boolean {
    const url = window.location.href;
    return SKIP_URL_PATTERNS.some(pattern => pattern.test(url));
}

/* ── Font injection (OpenDyslexia into host page <head>) ── */

function applyFont(enabled: boolean) {
    const id = 'acrc-dynamic-theme';
    document.getElementById(id)?.remove();
    if (!enabled) return;

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
            cursor: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='48' height='48' viewBox='0 0 32 32'%3E%3Cpath d='M8 4l16 12-16 12V4z' fill='%23FF4A4A' stroke='white' stroke-width='3'/%3E%3C/svg%3E") 8 4, auto !important;
        }
    `;
    document.head.appendChild(style);
}

function clearFont() {
    document.getElementById('acrc-dynamic-theme')?.remove();
}

/* ── Main App ─────────────────────────────────────────────── */

const App: React.FC<{ shadowContainer: HTMLElement }> = ({ shadowContainer }) => {
    const [prefs, setPrefs] = useState<Preferences>(DEFAULT_PREFERENCES);
    const [struggleEvent, setStruggleEvent] = useState<StruggleEvent | null>(null);
    const [showPopup, setShowPopup] = useState(false);
    const [showSoftSuggest, setShowSoftSuggest] = useState(false);
    const [spokenCharIndex, setSpokenCharIndex] = useState(-1);
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
    }, []);

    // Apply OpenDyslexia font when prefs change
    useEffect(() => {
        if (!prefs.enabled) {
            clearFont();
            return;
        }
        applyFont(true);

        return () => {
            clearFont();
        };
    }, [prefs.enabled]);

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
                    try {
                        chrome.runtime.sendMessage({
                            type: 'CONFUSED_WORD',
                            word: event.word,
                        });
                    } catch { /* ignore */ }
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
