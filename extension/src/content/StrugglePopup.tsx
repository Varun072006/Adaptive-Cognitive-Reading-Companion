// ============================================================
// StrugglePopup.tsx — comprehensive "Need help?" popup
// ============================================================

import React, { useState } from 'react';
import { simplifyText, defineWord, SimplifyMode, DefineResponse } from '../lib/api';

interface Props {
    word: string;
    sentence: string;
    element: HTMLElement | null;
    rect?: DOMRect;
    onDismiss: () => void;
    onDismissWord: (word: string) => void;
    onSpeak: (text: string, rate?: number) => void;
    spokenCharIndex?: number;
    defaultLevel?: 1 | 2 | 3;
}

const StrugglePopup: React.FC<Props> = ({
    word,
    sentence,
    element,
    rect: selectionRect,
    onDismiss,
    onDismissWord,
    onSpeak,
    spokenCharIndex = -1,
    defaultLevel = 2,
}) => {
    const [result, setResult] = useState<string | null>(null);
    const [defineResult, setDefineResult] = useState<DefineResponse | null>(null);
    const [loading, setLoading] = useState(false);
    const [activeAction, setActiveAction] = useState<string | null>(null);
    const [level, setLevel] = useState<1 | 2 | 3>(defaultLevel);
    const [speechRate, setSpeechRate] = useState(1.0);

    // Position near the word (using viewport coords since parent is fixed)
    const rect = element?.getBoundingClientRect() || selectionRect;
    let top = rect ? rect.bottom + 8 : 100;
    const left = rect ? Math.min(rect.left, window.innerWidth - 360) : 100;

    // Flip to top if it overflows bottom
    if (top + 300 > window.innerHeight) {
        top = rect ? rect.top - 310 : 100;
    }

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
                const res = await defineWord({ word });
                if (res.error) {
                    setResult(`Error: ${res.error}`);
                } else {
                    setDefineResult(res);
                }
            } else {
                if (!sentence || sentence.trim() === '') {
                    setResult('No context available to simplify. Try another word or paragraph.');
                    setLoading(false);
                    return;
                }
                const mode = action as SimplifyMode;
                const res = await simplifyText({ text: sentence, mode, level });
                if (res.error) {
                    setResult(`Error: ${res.error}`);
                } else if (mode === 'mindmap' && res.mindmapData) {
                    setResult('mindmap_render');
                    setDefineResult(res.mindmapData as any); // using defineResult state to hold structured data
                } else {
                    setResult(res.result);
                }
            }
        } catch {
            setResult('Something went wrong. Please try again.');
        } finally {
            setLoading(false);
        }
    };

    const btnStyle = (key: string) => ({
        display: 'flex' as const,
        alignItems: 'center' as const,
        gap: '4px',
        padding: '6px 10px',
        background: activeAction === key ? 'rgba(74, 144, 217, 0.3)' : 'rgba(255,255,255,0.08)',
        border: '1px solid rgba(255,255,255,0.12)',
        borderRadius: '8px',
        color: '#e0e0e0',
        fontSize: '11px',
        cursor: loading ? 'wait' : 'pointer',
        transition: 'all 0.2s ease',
    });

    const renderReadingText = () => {
        if (!sentence) return null;
        if (spokenCharIndex < 0) return sentence;

        let endIndex = sentence.indexOf(' ', spokenCharIndex);
        if (endIndex === -1) endIndex = sentence.length;

        const before = sentence.slice(0, spokenCharIndex);
        const activeWord = sentence.slice(spokenCharIndex, endIndex);
        const after = sentence.slice(endIndex);

        return (
            <>
                {before}
                <mark style={{ backgroundColor: '#4A90D9', color: 'white', borderRadius: '3px', padding: '0 2px' }}>{activeWord}</mark>
                {after}
            </>
        );
    };

    return (
        <div
            className="acrc-popup"
            style={{
                position: 'absolute',
                top: `${top}px`,
                left: `${Math.max(8, left)}px`,
                width: '350px',
                maxHeight: '480px',
                overflowY: 'auto',
                background: 'linear-gradient(135deg, #1a1a2e 0%, #16213e 100%)',
                border: '1px solid rgba(74, 144, 217, 0.3)',
                borderRadius: '16px',
                padding: '14px',
                boxShadow: '0 8px 32px rgba(0, 0, 0, 0.4), 0 0 0 1px rgba(255,255,255,0.05)',
                zIndex: 2147483646,
                pointerEvents: 'auto',
                fontFamily: 'Inter, system-ui, sans-serif',
                color: '#e0e0e0',
                animation: 'acrc-slide-up 0.3s ease-out',
            }}
        >
            {/* Header */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
                <span style={{ fontSize: '13px', fontWeight: 600 }}>
                    Need help with <span style={{ color: '#4A90D9', fontWeight: 700 }}>"{word}"</span>?
                </span>
                <button
                    onClick={onDismiss}
                    style={{ background: 'none', border: 'none', color: '#888', cursor: 'pointer', fontSize: '16px', padding: '2px', lineHeight: 1 }}
                >✕</button>
            </div>

            {/* Level selector */}
            <div style={{ display: 'flex', gap: '4px', marginBottom: '10px' }}>
                {([1, 2, 3] as const).map(l => (
                    <button
                        key={l}
                        onClick={() => setLevel(l)}
                        style={{
                            flex: 1,
                            padding: '4px',
                            fontSize: '10px',
                            borderRadius: '6px',
                            border: level === l ? '1px solid #4A90D9' : '1px solid rgba(255,255,255,0.1)',
                            background: level === l ? 'rgba(74,144,217,0.2)' : 'transparent',
                            color: level === l ? '#4A90D9' : '#888',
                            cursor: 'pointer',
                            transition: 'all 0.2s',
                        }}
                    >
                        {l === 1 ? '🟢 Easy' : l === 2 ? '🟡 Simpler' : '🔴 Simplest'}
                    </button>
                ))}
            </div>

            {/* Primary actions */}
            <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', marginBottom: '8px' }}>
                {[
                    { key: 'speak', icon: '🔊', label: 'Read' },
                    { key: 'define', icon: '💡', label: 'Define' },
                    { key: 'simplify', icon: '📖', label: 'Simplify' },
                    { key: 'explain_sentence', icon: '🧠', label: 'Explain' },
                    { key: 'mindmap', icon: '🗺️', label: 'Mindmap' },
                ].map(({ key, icon, label }) => (
                    <button key={key} onClick={() => handleAction(key)} disabled={loading} style={btnStyle(key)}>
                        {icon} {label}
                    </button>
                ))}
            </div>

            {/* Advanced actions (collapsed row) */}
            <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', marginBottom: result || defineResult ? '10px' : '6px' }}>
                {[
                    { key: 'breakdown', icon: '✂️', label: 'Break Down' },
                    { key: 'rephrase', icon: '🔄', label: 'Rephrase' },
                    { key: 'bullet_summary', icon: '📋', label: 'Bullets' },
                ].map(({ key, icon, label }) => (
                    <button key={key} onClick={() => handleAction(key)} disabled={loading} style={btnStyle(key)}>
                        {icon} {label}
                    </button>
                ))}
            </div>

            {/* Loading */}
            {loading && (
                <div style={{ textAlign: 'center', padding: '8px', fontSize: '12px', color: '#4A90D9' }}>
                    ⏳ Thinking...
                </div>
            )}

            {/* Word Insight Panel (define result) */}
            {defineResult && !loading && (
                <div style={{
                    background: 'rgba(255,255,255,0.05)',
                    borderRadius: '10px',
                    padding: '12px',
                    fontSize: '12px',
                    lineHeight: 1.6,
                }}>
                    <div style={{ marginBottom: '6px' }}>
                        <strong style={{ color: '#4A90D9' }}>📖 </strong>
                        {defineResult.definition}
                    </div>
                    {defineResult.pronunciation && (
                        <div style={{ marginBottom: '4px', color: '#aaa' }}>
                            🔊 <em>{defineResult.pronunciation}</em>
                            <button onClick={() => onSpeak(word)} style={{ marginLeft: '6px', background: 'none', border: 'none', color: '#4A90D9', cursor: 'pointer', fontSize: '11px' }}>▶ Play</button>
                        </div>
                    )}
                    {defineResult.example && (
                        <div style={{ marginBottom: '4px', color: '#bbb' }}>
                            💬 "<em>{defineResult.example}</em>"
                        </div>
                    )}
                    {defineResult.synonyms?.length > 0 && (
                        <div style={{ marginBottom: '4px' }}>
                            <strong style={{ color: '#52B788' }}>🔗 Synonyms: </strong>
                            {defineResult.synonyms.join(', ')}
                        </div>
                    )}
                    {defineResult.analogy && (
                        <div style={{ marginBottom: '4px' }}>
                            <strong style={{ color: '#F4A261' }}>💡 Analogy: </strong>
                            {defineResult.analogy}
                        </div>
                    )}
                    {defineResult.is_abbreviation && defineResult.expanded_form && (
                        <div style={{ color: '#7B68EE' }}>
                            <strong>📝 Stands for: </strong>{defineResult.expanded_form}
                        </div>
                    )}
                </div>
            )}

            {/* Text result (simplify/explain/etc) */}
            {result && result !== 'mindmap_render' && result !== 'reading_render' && !loading && !defineResult && (
                <div style={{
                    background: 'rgba(255,255,255,0.05)',
                    borderRadius: '10px',
                    padding: '12px',
                    fontSize: '12px',
                    lineHeight: 1.6,
                    whiteSpace: 'pre-wrap',
                    maxHeight: '150px',
                    overflowY: 'auto',
                }}>
                    {result}
                    <button
                        onClick={() => onSpeak(result)}
                        style={{ display: 'block', marginTop: '6px', background: 'none', border: 'none', color: '#4A90D9', cursor: 'pointer', fontSize: '11px' }}
                    >🔊 Read aloud</button>
                </div>
            )}

            {/* Active Reading Render */}
            {result === 'reading_render' && !loading && (
                <div style={{
                    background: 'rgba(255,255,255,0.05)',
                    borderRadius: '10px',
                    padding: '12px',
                    fontSize: '14px',
                    lineHeight: 1.6,
                    maxHeight: '200px',
                    overflowY: 'auto',
                }}>
                    <div style={{ marginBottom: '10px', display: 'flex', gap: '8px', alignItems: 'center' }}>
                        <strong style={{ color: '#4A90D9', flex: 1 }}>🔊 Active Reading</strong>
                        {[0.7, 1.0, 1.5].map(rate => (
                            <button
                                key={rate}
                                onClick={() => { setSpeechRate(rate); onSpeak(sentence, rate); }}
                                style={{
                                    background: speechRate === rate ? '#4A90D9' : 'rgba(255,255,255,0.1)',
                                    border: 'none',
                                    borderRadius: '6px',
                                    padding: '4px 8px',
                                    color: 'white',
                                    fontSize: '10px',
                                    cursor: 'pointer'
                                }}
                            >
                                {rate}x
                            </button>
                        ))}
                    </div>
                    <div>{renderReadingText()}</div>
                </div>
            )}

            {/* Mindmap Render */}
            {result === 'mindmap_render' && !loading && defineResult && (
                <div style={{
                    background: 'rgba(255,255,255,0.05)',
                    borderRadius: '10px',
                    padding: '12px',
                    fontSize: '12px',
                    lineHeight: 1.4,
                    maxHeight: '200px',
                    overflowY: 'auto',
                    borderLeft: '2px solid #52B788'
                }}>
                    <strong style={{ color: '#52B788', fontSize: '14px', display: 'block', marginBottom: '8px' }}>
                        {(defineResult as any).main_topic || 'Mindmap'}
                    </strong>
                    <ul style={{ paddingLeft: '14px', margin: 0, listStyleType: 'none' }}>
                        {((defineResult as any).subtopics || []).map((sub: any, i: number) => (
                            <li key={i} style={{ marginBottom: '8px', position: 'relative' }}>
                                <div style={{
                                    position: 'absolute', left: '-10px', top: '6px',
                                    width: '6px', height: '6px', borderRadius: '50%', background: '#4A90D9'
                                }} />
                                <strong style={{ color: '#4A90D9' }}>{sub.topic}</strong>
                                {sub.details && sub.details.length > 0 && (
                                    <ul style={{ paddingLeft: '12px', marginTop: '4px', listStyleType: 'circle', color: '#ccc' }}>
                                        {sub.details.map((detail: string, j: number) => (
                                            <li key={j} style={{ marginBottom: '2px' }}>{detail}</li>
                                        ))}
                                    </ul>
                                )}
                            </li>
                        ))}
                    </ul>
                </div>
            )}

            {/* Don't ask again */}
            <button
                onClick={() => onDismissWord(word)}
                style={{
                    display: 'block', width: '100%', marginTop: '6px',
                    background: 'none', border: 'none', color: '#555',
                    fontSize: '10px', cursor: 'pointer', textAlign: 'center',
                }}
            >
                Don't ask about this word again
            </button>
        </div>
    );
};

export default StrugglePopup;
