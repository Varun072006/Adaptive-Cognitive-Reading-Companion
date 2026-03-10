// ============================================================
// StrugglePopup.tsx — comprehensive "Need help?" popup
// With glassmorphism aesthetics and context-aware AI
// ============================================================

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { simplifyText, defineWord, SimplifyMode, DefineResponse } from '../lib/api';
import MermaidRenderer from './MermaidRenderer';

interface PopupTheme {
    bg: string;
    text: string;
    link: string;
    accent: string;
    subtleBg: string;
    borderColor: string;
}

const DEFAULT_THEME: PopupTheme = {
    bg: 'rgba(253, 246, 227, 0.98)',
    text: '#333333',
    link: '#4A90D9',
    accent: '#4A90D9',
    subtleBg: 'rgba(0,0,0,0.03)',
    borderColor: 'rgba(0,0,0,0.1)',
};

interface Props {
    word: string;
    sentence: string;
    context?: string;
    element: HTMLElement | null;
    rect?: DOMRect;
    onDismiss: () => void;
    onDismissWord: (word: string) => void;
    onSpeak: (text: string, rate?: number) => void;
    spokenCharIndex?: number;
    defaultLevel?: 1 | 2 | 3;
    theme?: PopupTheme;
}

const jsonToMermaid = (data: any): string => {
    if (!data || !data.main_topic) return '';

    // Extremely robust mindmap syntax using brackets for all nodes with spaces
    let chart = 'mindmap\n';
    const root = data.main_topic.replace(/[()]/g, '').replace(/"/g, "'").trim();
    chart += `  (("${root}"))\n`;

    if (data.subtopics && Array.isArray(data.subtopics)) {
        data.subtopics.forEach((sub: any) => {
            const subTopic = sub.topic.replace(/[\[\]]/g, '').replace(/"/g, "'").trim();
            chart += `    ["${subTopic}"]\n`;
            if (sub.details && Array.isArray(sub.details)) {
                sub.details.forEach((detail: string) => {
                    const cleanDetail = detail.replace(/[()]/g, '').replace(/"/g, "'").trim();
                    chart += `      ("${cleanDetail}")\n`;
                });
            }
        });
    }
    return chart;
};

const StrugglePopup: React.FC<Props> = ({
    word,
    sentence,
    context,
    element,
    rect: selectionRect,
    onDismiss,
    onDismissWord,
    onSpeak,
    spokenCharIndex = -1,
    defaultLevel = 2,
    theme = DEFAULT_THEME,
}) => {
    const [result, setResult] = useState<string | null>(null);
    const [defineResult, setDefineResult] = useState<DefineResponse | null>(null);
    const [loading, setLoading] = useState(false);
    const [activeAction, setActiveAction] = useState<string | null>(null);
    const [level, setLevel] = useState<1 | 2 | 3>(defaultLevel);
    const [speechRate, setSpeechRate] = useState(1.0);
    const [mermaidChart, setMermaidChart] = useState<string>('');
    const [zoom, setZoom] = useState(1.0);
    const [hoveredBtn, setHoveredBtn] = useState<string | null>(null);
    const popupRef = useRef<HTMLDivElement>(null);

    const [pos, setPos] = useState(() => {
        const r = element?.getBoundingClientRect() || selectionRect;
        let t = r ? r.bottom + 8 : 100;
        const l = r ? Math.min(r.left, window.innerWidth - 360) : 100;
        if (t + 300 > window.innerHeight) {
            t = r ? r.top - 310 : 100;
        }
        return { top: t, left: l };
    });

    const [isDragging, setIsDragging] = useState(false);
    const [dragStart, setDragStart] = useState({ x: 0, y: 0 });

    const handleMouseDown = (e: React.MouseEvent) => {
        if (result === 'mindmap_render') return;
        setIsDragging(true);
        setDragStart({ x: e.clientX - pos.left, y: e.clientY - pos.top });
    };

    // Click-outside-to-close
    useEffect(() => {
        const handleClickOutside = (e: MouseEvent) => {
            if (popupRef.current) {
                const path = e.composedPath();
                if (!path.includes(popupRef.current)) {
                    onDismiss();
                }
            }
        };

        // Use true (capture phase) to ensure it reliably intercepts outside clicks
        document.addEventListener('mousedown', handleClickOutside, true);

        return () => {
            document.removeEventListener('mousedown', handleClickOutside, true);
        };
    }, [onDismiss]);

    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.key === 'Escape') onDismiss();
        };
        window.addEventListener('keydown', handleKeyDown);

        if (!isDragging) {
            return () => {
                window.removeEventListener('keydown', handleKeyDown);
            };
        }
        const handleMouseMove = (e: MouseEvent) => {
            setPos({ left: e.clientX - dragStart.x, top: e.clientY - dragStart.y });
        };
        const handleMouseUp = () => { setIsDragging(false); };
        window.addEventListener('mousemove', handleMouseMove);
        window.addEventListener('mouseup', handleMouseUp);
        return () => {
            window.removeEventListener('keydown', handleKeyDown);
            window.removeEventListener('mousemove', handleMouseMove);
            window.removeEventListener('mouseup', handleMouseUp);
        };
    }, [isDragging, dragStart, onDismiss]);

    const handleAction = async (action: string) => {
        if (action === 'speak') {
            onSpeak(sentence, speechRate);
            setResult('reading_render');
            setActiveAction(action);
            return;
        }
        setLoading(true);
        setActiveAction(action);
        setResult(null);
        setDefineResult(null);
        try {
            if (action === 'define') {
                const res = await defineWord({ word, context });
                if (res.error) setResult(`Error: ${res.error}`);
                else setDefineResult(res);
            } else {
                if (!sentence || sentence.trim() === '') {
                    setResult('No context available to simplify. Try another word or paragraph.');
                    setLoading(false);
                    return;
                }
                const mode = action as SimplifyMode;
                const res = await simplifyText({ text: sentence, mode, level, context });
                if (res.error) setResult(`Error: ${res.error}`);
                else if (mode === 'mindmap' && res.mindmapData) {
                    setResult('mindmap_render');
                    setDefineResult(res.mindmapData as any);
                    setMermaidChart(jsonToMermaid(res.mindmapData));
                } else setResult(res.result);
            }
        } catch (err: any) {
            // Specifically catch extension context invalidation
            if (err.message && err.message.includes('Extension context invalidated')) {
                console.warn('[ACRC] handleAction warning: Extension context invalidated. User needs to refresh.');
                setResult('Error: Extension updated. Please refresh the page to continue.');
            } else {
                console.error('[ACRC] handleAction error:', err);
                setResult(`Error: ${err.message || 'Something went wrong.'}`);
            }
        } finally {
            setLoading(false);
        }
    };

    const getBtnStyle = (key: string) => {
        const isHovered = hoveredBtn === key;
        const isActive = activeAction === key;
        return {
            display: 'flex', alignItems: 'center', gap: '4px', padding: '6px 10px',
            background: isActive ? `${theme.accent}33` : isHovered ? `${theme.accent}18` : theme.subtleBg,
            border: isActive ? `1px solid ${theme.accent}80` : isHovered ? `1px solid ${theme.accent}50` : `1px solid ${theme.borderColor}`,
            borderRadius: '8px', color: theme.text, fontSize: '11px', cursor: loading ? 'wait' : 'pointer', backdropFilter: 'blur(4px)',
            transform: isHovered && !isActive ? 'translateY(-2px)' : 'none',
            boxShadow: isHovered && !isActive ? `0 4px 12px ${theme.accent}22` : 'none',
            transition: 'all 0.2s ease',
        };
    };

    const renderReadingText = () => {
        if (!sentence) return null;
        if (spokenCharIndex < 0) return sentence;
        let endIndex = sentence.indexOf(' ', spokenCharIndex);
        if (endIndex === -1) endIndex = sentence.length;
        const before = sentence.slice(0, spokenCharIndex);
        const activeWord = sentence.slice(spokenCharIndex, endIndex);
        const after = sentence.slice(endIndex);
        return (<>{before}<mark style={{ backgroundColor: theme.accent, color: 'white', borderRadius: '3px', padding: '0 2px' }}>{activeWord}</mark>{after}</>);
    };

    const renderInteractiveText = (text: string) => {
        if (!text) return null;
        return text.split(' ').map((word, i) => (
            <span key={i} className="acrc-interactive-word" onClick={() => onSpeak(word.replace(/[^a-zA-Z]/g, ''))}>
                {word}
            </span>
        )).reduce((prev, curr) => [prev, ' ', curr] as any);
    };

    const isExpanded = !!loading || !!result || !!defineResult || !!mermaidChart;
    const isFullScreen = result === 'mindmap_render';
    const popupWidth = isFullScreen ? window.innerWidth * 0.96 : (isExpanded ? 800 : 360);
    const popupHeight = isFullScreen ? window.innerHeight * 0.96 : 500;

    // Shift left if expanded to stay on screen
    let finalLeft = pos.left;
    let finalTop = pos.top;

    // For normal dragging, we just use the bounds checking to keep it firmly on screen.
    // If we're not full screen, apply expanded bound limits.
    if (!isFullScreen) {
        finalLeft = Math.max(8, pos.left);
        finalTop = Math.max(8, pos.top);
        if (isExpanded && finalLeft + popupWidth > window.innerWidth - 20) {
            finalLeft = Math.max(8, window.innerWidth - popupWidth - 20);
        }
    } else {
        // Enforce center positioning ONLY for Full Screen Mind Map mode.
        finalLeft = (window.innerWidth - popupWidth) / 2;
        finalTop = (window.innerHeight - popupHeight) / 2;
    }

    const transitionStyle = isDragging
        ? 'none'
        : 'width 0.4s cubic-bezier(0.16, 1, 0.3, 1), height 0.4s cubic-bezier(0.16, 1, 0.3, 1), top 0.4s cubic-bezier(0.16, 1, 0.3, 1), left 0.4s cubic-bezier(0.16, 1, 0.3, 1)';

    return (
        <div ref={popupRef} className="acrc-popup" style={{
            position: 'fixed', top: `${finalTop}px`, left: `${finalLeft}px`,
            width: `${popupWidth}px`, height: `${popupHeight}px`,
            background: theme.bg,
            backdropFilter: 'blur(32px)', WebkitBackdropFilter: 'blur(32px)', border: `1px solid ${theme.borderColor}`, borderRadius: '24px',
            boxShadow: '0 12px 48px rgba(0, 0, 0, 0.15), 0 0 0 1px rgba(0,0,0,0.05), inset 0 1px 0 rgba(255,255,255,0.5)',
            zIndex: 2147483646, pointerEvents: 'auto', color: theme.text,
            display: 'flex', overflow: 'hidden', transition: transitionStyle
        }}>
            {/* Sidebar (Controls) */}
            <div style={{
                width: '360px',
                flexShrink: 0,
                padding: '24px',
                display: 'flex',
                flexDirection: 'column',
                gap: '16px',
                borderRight: `1px solid ${theme.borderColor}`,
                overflowY: 'auto',
                maxHeight: '100%',
                scrollbarWidth: 'thin',
                scrollbarColor: `${theme.accent}66 transparent`
            }}>
                <div onMouseDown={handleMouseDown} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', cursor: result === 'mindmap_render' ? 'default' : 'move', userSelect: 'none', background: theme.subtleBg, padding: '10px', borderRadius: '12px', marginBottom: '8px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                        <span style={{ fontSize: '18px', color: theme.accent, cursor: result === 'mindmap_render' ? 'default' : 'grab' }}>⠿</span>
                        <span style={{ fontSize: '16px', fontWeight: 600, color: theme.text }}>Need help?</span>
                    </div>
                    <button onMouseDown={(e) => e.stopPropagation()} onClick={onDismiss} style={{ background: theme.subtleBg, border: 'none', color: theme.text, cursor: 'pointer', fontSize: '20px', padding: '8px', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'all 0.2s' }} title="Close (Esc)">✕</button>
                </div>

                <div style={{ padding: '0 4px', marginBottom: '4px' }}>
                    <span style={{ fontSize: '12px', color: theme.text, opacity: 0.6 }}>Currently reading:</span><br />
                    <span style={{ color: theme.accent, fontWeight: 700, fontSize: '18px' }}>"{word}"</span>
                </div>

                <div style={{ display: 'flex', gap: '6px' }}>
                    {([1, 2, 3] as const).map(l => (
                        <button key={l} onClick={() => setLevel(l)} style={{ flex: 1, padding: '8px 4px', fontSize: '12px', borderRadius: '10px', border: level === l ? `2px solid ${theme.accent}` : `1px solid ${theme.borderColor}`, background: level === l ? `${theme.accent}1A` : theme.subtleBg, color: level === l ? theme.accent : theme.text, cursor: 'pointer', transition: 'all 0.2s', fontWeight: level === l ? 700 : 400, opacity: level === l ? 1 : 0.7 }}>
                            {l === 1 ? ' Easy' : l === 2 ? ' Simpler' : ' Simplest'}
                        </button>
                    ))}
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '12px' }}>
                    {[
                        { key: 'speak', icon: '👤', label: 'Read Text' },
                        { key: 'define', icon: '📖', label: 'Dictionary' },
                        { key: 'simplify', icon: '🪄', label: 'Simpler' },
                        { key: 'explain_sentence', icon: '👩‍🏫', label: 'Explain' },
                        { key: 'mindmap', icon: '🗺️', label: 'Mind Map' },
                        { key: 'breakdown', icon: '🔨', label: 'Break Down' },
                        { key: 'rephrase', icon: '🔄', label: 'Rephrase' },
                        { key: 'bullet_summary', icon: '📝', label: 'Bullets' },
                    ].map(({ key, icon, label }) => (
                        <button key={key} className="acrc-btn" onClick={() => handleAction(key)} disabled={loading}
                            onMouseEnter={() => setHoveredBtn(key)}
                            onMouseLeave={() => setHoveredBtn(null)}
                            style={{ ...getBtnStyle(key), padding: '12px 4px', flexDirection: 'column', height: '80px', fontSize: '12px', width: 'auto' }}>
                            <span style={{ fontSize: '24px', marginBottom: '6px', transition: 'transform 0.2s ease', transform: hoveredBtn === key ? 'scale(1.15)' : 'scale(1)' }}>{icon}</span>
                            <span style={{ fontWeight: 600 }}>{label}</span>
                        </button>
                    ))}
                </div>

                <div style={{ marginTop: 'auto' }}>
                    <button onClick={() => onDismissWord(word)} style={{ width: '100%', background: 'none', border: 'none', color: theme.text, opacity: 0.5, fontSize: '11px', cursor: 'pointer', padding: '8px' }}>Don't ask about this word again</button>
                </div>
            </div>

            {/* Main Stage (Output) */}
            <div style={{ flex: 1, padding: '24px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '20px', background: theme.subtleBg, scrollbarWidth: 'thin', scrollbarColor: `${theme.accent}66 transparent` }}>
                {!isExpanded ? (
                    <div style={{ height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: theme.text, opacity: 0.5, textAlign: 'center', fontStyle: 'italic', fontSize: '14px' }}>
                        Select a tool on the left to begin exploring.
                    </div>
                ) : (
                    <>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: `1px solid ${theme.borderColor}`, paddingBottom: '12px' }}>
                            <span style={{ fontSize: '16px', fontWeight: 600, color: theme.accent, textTransform: 'capitalize' }}>
                                {activeAction?.replace(/_/g, ' ')}
                            </span>
                            {loading && <span style={{ fontSize: '12px', color: theme.accent }}>⏳ Processing...</span>}
                        </div>

                        {defineResult && !loading && !mermaidChart && (
                            <div style={{ background: theme.subtleBg, borderRadius: '16px', padding: '20px', fontSize: '16px', lineHeight: 1.6, color: theme.text }}>
                                <div style={{ marginBottom: '12px' }}><strong style={{ color: theme.accent }}>📖 Definition:</strong><br />{renderInteractiveText(defineResult.definition)}</div>
                                {defineResult.pronunciation && <div style={{ marginBottom: '10px', color: theme.text, opacity: 0.6, fontSize: '14px' }}>🔊 <em>{defineResult.pronunciation}</em></div>}
                                {defineResult.example && <div style={{ marginBottom: '12px', color: theme.text, opacity: 0.7, fontStyle: 'italic' }}>💬 "{renderInteractiveText(defineResult.example)}"</div>}
                                <button onClick={() => onSpeak(`${defineResult.definition}. ${defineResult.example ? 'Example: ' + defineResult.example : ''}`)} style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', marginTop: '12px', background: `${theme.accent}1A`, border: `1px solid ${theme.accent}4D`, color: theme.accent, cursor: 'pointer', fontSize: '14px', padding: '10px 20px', borderRadius: '12px', fontWeight: 700 }}>🔊 Listen to definition</button>
                            </div>
                        )}

                        {result && result !== 'mindmap_render' && result !== 'reading_render' && !loading && (
                            <div style={{ background: theme.subtleBg, borderRadius: '16px', padding: '20px', fontSize: '16px', lineHeight: 1.7, whiteSpace: 'pre-wrap', color: theme.text }}>
                                {renderInteractiveText(result)}
                                <br /><br />
                                <button onClick={() => onSpeak(result)} style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', background: `${theme.accent}1A`, border: `1px solid ${theme.accent}4D`, color: theme.accent, cursor: 'pointer', fontSize: '14px', padding: '10px 20px', borderRadius: '12px', fontWeight: 700 }}>🔊 Listen to text</button>
                            </div>
                        )}

                        {result === 'reading_render' && !loading && (
                            <div style={{ background: theme.subtleBg, borderRadius: '16px', padding: '20px', fontSize: '18px', lineHeight: 1.8, color: theme.text }}>
                                <div style={{ marginBottom: '12px' }}><strong style={{ color: theme.accent }}>🔊 Active Reading</strong></div>
                                <div>{renderReadingText()}</div>
                            </div>
                        )}

                        {result === 'mindmap_render' && !loading && defineResult && (
                            <div style={{ background: theme.subtleBg, borderRadius: '20px', padding: '24px', border: `1px solid ${theme.accent}33`, flex: 1, display: 'flex', flexDirection: 'column', minHeight: '450px' }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
                                    <strong style={{ color: theme.accent, fontSize: '18px' }}>🗺️ {(defineResult as any).main_topic || 'Mind Map'}</strong>
                                    <div style={{ display: 'flex', gap: '8px' }}>
                                        <button onClick={() => setZoom(z => Math.max(0.5, z - 0.1))} style={{ background: theme.subtleBg, border: 'none', color: theme.text, cursor: 'pointer', padding: '6px 12px', borderRadius: '8px', fontSize: '14px' }}>-</button>
                                        <button onClick={() => setZoom(1.0)} style={{ background: theme.subtleBg, border: 'none', color: theme.text, cursor: 'pointer', padding: '6px 12px', borderRadius: '8px', fontSize: '12px' }}>{Math.round(zoom * 100)}%</button>
                                        <button onClick={() => setZoom(z => Math.min(3.0, z + 0.1))} style={{ background: theme.subtleBg, border: 'none', color: theme.text, cursor: 'pointer', padding: '6px 12px', borderRadius: '8px', fontSize: '14px' }}>+</button>
                                        <button onClick={() => onSpeak(`${(defineResult as any).main_topic}. ${(defineResult as any).subtopics.map((s: any) => `${s.topic}`).join('. ')}`)} style={{ background: `${theme.accent}1A`, border: `1px solid ${theme.accent}4D`, color: theme.accent, cursor: 'pointer', fontSize: '13px', padding: '8px 16px', borderRadius: '10px', fontWeight: 700 }}>🔊 Listen</button>
                                    </div>
                                </div>
                                <div style={{ flex: 1, overflow: 'hidden', cursor: 'grab', position: 'relative', border: `1px solid ${theme.borderColor}`, borderRadius: '12px', background: 'rgba(255,255,255,0.4)', boxShadow: 'inset 0 2px 10px rgba(0,0,0,0.02)' }}>
                                    <MermaidRenderer chart={mermaidChart} zoom={zoom} onSpeak={onSpeak} />
                                </div>
                                <div style={{ marginTop: '10px', fontSize: '11px', color: theme.text, opacity: 0.5, textAlign: 'center' }}>
                                    Tip: Use + / - to zoom, and drag to move the map.
                                </div>
                            </div>
                        )}
                    </>
                )}
            </div>
        </div>
    );
};

export default StrugglePopup;
