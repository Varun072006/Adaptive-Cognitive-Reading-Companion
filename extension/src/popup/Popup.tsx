// ============================================================
// Popup.tsx — Extension popup with comprehensive reading controls
// ============================================================

import React, { useState, useEffect } from 'react';
import { DEFAULT_PREFERENCES, Preferences } from '../lib/constants';

const BG_THEMES = [
    { value: 'default', label: 'Default', color: 'transparent' },
    { value: 'cream', label: 'Cream', color: '#FFF8E7' },
    { value: 'light-blue', label: 'Sky', color: '#E8F4FD' },
    { value: 'light-green', label: 'Mint', color: '#E8F5E9' },
    { value: 'dark', label: 'Dark', color: '#1a1a1a' },
] as const;

const HIGHLIGHT_COLORS = [
    '#4A90D9', '#52B788', '#F4A261', '#E76F51', '#7B68EE', '#FF6B9D',
];

const Popup: React.FC = () => {
    const [prefs, setPrefs] = useState<Preferences>(DEFAULT_PREFERENCES);
    const [section, setSection] = useState<'main' | 'typography' | 'focus' | 'ai' | 'tts' | 'privacy'>('main');

    useEffect(() => {
        chrome.storage.local.get('acrc_prefs', (data) => {
            if (data.acrc_prefs) {
                setPrefs({ ...DEFAULT_PREFERENCES, ...data.acrc_prefs });
            }
        });
    }, []);

    const updatePref = <K extends keyof Preferences>(key: K, value: Preferences[K]) => {
        const updated = { ...prefs, [key]: value };
        setPrefs(updated);
        chrome.storage.local.set({ acrc_prefs: updated });
    };

    const SectionBtn: React.FC<{ id: typeof section; icon: string; label: string }> = ({ id, icon, label }) => (
        <button
            onClick={() => setSection(id)}
            className={`flex-1 p-2 text-xs rounded-lg border transition-all ${section === id
                    ? 'bg-blue-500/20 border-blue-500/50 text-blue-300'
                    : 'bg-white/5 border-white/10 text-gray-400 hover:bg-white/10'
                }`}
        >{icon} {label}</button>
    );

    const Toggle: React.FC<{ checked: boolean; onChange: (v: boolean) => void; label: string }> = ({ checked, onChange, label }) => (
        <div className="flex items-center justify-between p-2 rounded-lg bg-white/5">
            <span className="text-sm">{label}</span>
            <label className="relative inline-flex items-center cursor-pointer">
                <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} className="sr-only peer" />
                <div className="w-9 h-5 bg-gray-600 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-blue-500"></div>
            </label>
        </div>
    );

    const Slider: React.FC<{ label: string; value: number; min: number; max: number; step: number; unit: string; onChange: (v: number) => void }> = ({ label, value, min, max, step, unit, onChange }) => (
        <div className="space-y-1">
            <div className="flex justify-between text-xs">
                <span className="text-gray-400">{label}</span>
                <span className="text-blue-400">{typeof value === 'number' ? (Number.isInteger(step) ? value : value.toFixed(step < 0.1 ? 2 : 1)) : value}{unit}</span>
            </div>
            <input type="range" min={min} max={max} step={step} value={value}
                onChange={(e) => onChange(parseFloat(e.target.value))}
                className="w-full h-1 bg-gray-700 rounded-lg appearance-none cursor-pointer accent-blue-500" />
        </div>
    );

    return (
        <div className="p-3 space-y-3 text-white" style={{ width: '360px', minHeight: '400px', background: 'linear-gradient(135deg, #0f0c29, #1a1a2e)' }}>
            {/* Header */}
            <div className="text-center space-y-1">
                <div className="text-xl">📖</div>
                <h1 className="text-base font-bold bg-gradient-to-r from-blue-400 to-purple-400 bg-clip-text text-transparent">
                    Reading Companion
                </h1>
            </div>

            {/* Master Toggle */}
            <div className="flex items-center justify-between p-3 rounded-xl bg-white/5 border border-white/10">
                <span className="text-sm font-medium">Enable on this page</span>
                <label className="relative inline-flex items-center cursor-pointer">
                    <input type="checkbox" checked={prefs.enabled} onChange={(e) => updatePref('enabled', e.target.checked)} className="sr-only peer" />
                    <div className="w-11 h-6 bg-gray-600 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-500"></div>
                </label>
            </div>

            {/* Section Nav */}
            <div className="flex gap-1">
                <SectionBtn id="main" icon="⚙️" label="Main" />
                <SectionBtn id="typography" icon="🔤" label="Type" />
                <SectionBtn id="focus" icon="🔦" label="Focus" />
                <SectionBtn id="ai" icon="🧠" label="AI" />
                <SectionBtn id="tts" icon="🔊" label="TTS" />
                <SectionBtn id="privacy" icon="🔒" label="Privacy" />
            </div>

            {/* ─── Main Section ─── */}
            {section === 'main' && (
                <div className="space-y-2">
                    <label className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Quick Features</label>
                    <Toggle checked={prefs.rulerEnabled} onChange={(v) => updatePref('rulerEnabled', v)} label="📏 Reading Ruler" />
                    <Toggle checked={prefs.lineFocusEnabled} onChange={(v) => updatePref('lineFocusEnabled', v)} label="🔦 Line Focus" />
                    <Toggle checked={prefs.highlightOnHover} onChange={(v) => updatePref('highlightOnHover', v)} label="✨ Word Highlight" />
                    <Toggle checked={prefs.paragraphIsolation} onChange={(v) => updatePref('paragraphIsolation', v)} label="📄 Paragraph Isolation" />
                    <Toggle checked={prefs.hideAds} onChange={(v) => updatePref('hideAds', v)} label="🚫 Hide Ads/Sidebars" />
                    <Toggle checked={prefs.struggleDetectionEnabled} onChange={(v) => updatePref('struggleDetectionEnabled', v)} label="🧠 Smart Help" />
                </div>
            )}

            {/* ─── Typography Section ─── */}
            {section === 'typography' && (
                <div className="space-y-3">
                    <label className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Font</label>
                    <div className="grid grid-cols-3 gap-2">
                        {[
                            { value: 'system' as const, label: 'System' },
                            { value: 'dyslexic' as const, label: 'Dyslexic' },
                            { value: 'lexie' as const, label: 'Lexie' },
                        ].map(({ value, label }) => (
                            <button key={value} onClick={() => updatePref('font', value)}
                                className={`p-2 text-xs rounded-lg border transition-all ${prefs.font === value ? 'bg-blue-500/20 border-blue-500/50 text-blue-300' : 'bg-white/5 border-white/10 text-gray-400 hover:bg-white/10'}`}
                            >{label}</button>
                        ))}
                    </div>

                    <Slider label="Font Size" value={prefs.fontSize} min={80} max={150} step={5} unit="%" onChange={(v) => updatePref('fontSize', v)} />
                    <Slider label="Letter Spacing" value={prefs.letterSpacing} min={0} max={0.3} step={0.01} unit="em" onChange={(v) => updatePref('letterSpacing', v)} />
                    <Slider label="Word Spacing" value={prefs.wordSpacing} min={0} max={0.5} step={0.01} unit="em" onChange={(v) => updatePref('wordSpacing', v)} />
                    <Slider label="Line Height" value={prefs.lineHeight} min={1.2} max={3} step={0.1} unit="" onChange={(v) => updatePref('lineHeight', v)} />

                    <label className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Visual Theme</label>
                    <Toggle checked={prefs.highContrast} onChange={(v) => updatePref('highContrast', v)} label="🔲 High Contrast" />
                    <Toggle checked={prefs.darkMode} onChange={(v) => updatePref('darkMode', v)} label="🌙 Dark Mode" />

                    <label className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Background</label>
                    <div className="flex gap-2">
                        {BG_THEMES.map(({ value, label, color }) => (
                            <button key={value} onClick={() => updatePref('bgColor', value)}
                                className={`flex-1 p-2 text-xs rounded-lg border transition-all text-center ${prefs.bgColor === value ? 'border-blue-500/50 ring-1 ring-blue-500/30' : 'border-white/10'}`}
                                style={{ background: color === 'transparent' ? 'rgba(255,255,255,0.05)' : color, color: value === 'dark' ? '#fff' : '#333' }}
                            >{label}</button>
                        ))}
                    </div>

                    <label className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Highlight Color</label>
                    <div className="flex gap-2">
                        {HIGHLIGHT_COLORS.map((c) => (
                            <button key={c} onClick={() => updatePref('highlightColor', c)}
                                className={`w-7 h-7 rounded-full border-2 transition-all ${prefs.highlightColor === c ? 'border-white scale-110' : 'border-transparent'}`}
                                style={{ background: c }} />
                        ))}
                    </div>
                </div>
            )}

            {/* ─── Focus Section ─── */}
            {section === 'focus' && (
                <div className="space-y-2">
                    <label className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Focus Modes</label>
                    <Toggle checked={prefs.rulerEnabled} onChange={(v) => updatePref('rulerEnabled', v)} label="📏 Reading Ruler" />
                    <Toggle checked={prefs.lineFocusEnabled} onChange={(v) => updatePref('lineFocusEnabled', v)} label="🔦 Line Focus (dim surroundings)" />
                    <Toggle checked={prefs.paragraphIsolation} onChange={(v) => updatePref('paragraphIsolation', v)} label="📄 Paragraph Isolation (blur others)" />
                    <Toggle checked={prefs.hideAds} onChange={(v) => updatePref('hideAds', v)} label="🚫 Hide Ads & Sidebars" />
                    <div className="p-3 rounded-lg bg-blue-500/10 border border-blue-500/20 text-xs text-blue-300">
                        💡 Paragraph isolation blurs everything except the paragraph you're hovering over. Hide ads removes sidebars, ads, and popups for a cleaner reading experience.
                    </div>
                </div>
            )}

            {/* ─── AI Section ─── */}
            {section === 'ai' && (
                <div className="space-y-3">
                    <label className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Default Simplification Level</label>
                    <div className="grid grid-cols-3 gap-2">
                        {([1, 2, 3] as const).map(l => (
                            <button key={l} onClick={() => updatePref('simplificationLevel', l)}
                                className={`p-2 text-xs rounded-lg border transition-all ${prefs.simplificationLevel === l ? 'bg-blue-500/20 border-blue-500/50 text-blue-300' : 'bg-white/5 border-white/10 text-gray-400 hover:bg-white/10'}`}
                            >{l === 1 ? '🟢 Slightly' : l === 2 ? '🟡 Clear' : '🔴 Very Basic'}</button>
                        ))}
                    </div>
                    <Toggle checked={prefs.struggleDetectionEnabled} onChange={(v) => updatePref('struggleDetectionEnabled', v)} label="🧠 Auto-detect struggle" />
                    <div className="p-3 rounded-lg bg-purple-500/10 border border-purple-500/20 text-xs text-purple-300">
                        🔒 All AI processing runs locally via Ollama. Your text never leaves your computer.
                    </div>
                </div>
            )}

            {/* ─── TTS Section ─── */}
            {section === 'tts' && (
                <div className="space-y-3">
                    <label className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Text-to-Speech</label>
                    <Slider label="Speed" value={prefs.ttsRate} min={0.5} max={2} step={0.1} unit="x" onChange={(v) => updatePref('ttsRate', v)} />
                    <Slider label="Pitch" value={prefs.ttsPitch} min={0.5} max={2} step={0.1} unit="" onChange={(v) => updatePref('ttsPitch', v)} />
                    <div className="p-3 rounded-lg bg-green-500/10 border border-green-500/20 text-xs text-green-300">
                        🔊 Click any word on the page to hear it. The extension uses your browser's built-in speech engine.
                    </div>
                </div>
            )}

            {/* ─── Privacy Section ─── */}
            {section === 'privacy' && (
                <div className="space-y-2">
                    <label className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Privacy Controls</label>
                    <Toggle checked={prefs.privacyAIEnabled} onChange={(v) => updatePref('privacyAIEnabled', v)} label="🧠 AI Processing" />
                    <Toggle checked={prefs.privacyCameraEnabled} onChange={(v) => updatePref('privacyCameraEnabled', v)} label="📷 Camera Access" />
                    <Toggle checked={prefs.privacyLogsEnabled} onChange={(v) => updatePref('privacyLogsEnabled', v)} label="📊 Reading Logs" />
                    <button
                        onClick={() => {
                            chrome.storage.local.remove('acrc_reading_history');
                            chrome.storage.local.remove('acrc_progress');
                        }}
                        className="w-full p-2 text-xs rounded-lg bg-red-500/10 border border-red-500/30 text-red-400 hover:bg-red-500/20 transition-all"
                    >🗑️ Clear All Reading Data</button>
                    <div className="p-3 rounded-lg bg-blue-500/10 border border-blue-500/20 text-xs text-blue-300">
                        🔒 All data stays on your device. AI runs locally via Ollama. No cloud, no tracking.
                    </div>
                </div>
            )}

            {/* Quick links */}
            <div className="pt-2 border-t border-white/10 flex gap-2">
                <a href="http://localhost:3000/scanner" target="_blank" rel="noreferrer"
                    className="flex-1 p-2 text-center text-xs rounded-lg bg-gradient-to-r from-blue-500/20 to-purple-500/20 border border-blue-500/30 text-blue-300 hover:bg-blue-500/30 transition-all"
                >📷 Scanner</a>
                <a href="http://localhost:3000/dashboard" target="_blank" rel="noreferrer"
                    className="flex-1 p-2 text-center text-xs rounded-lg bg-gradient-to-r from-green-500/20 to-teal-500/20 border border-green-500/30 text-green-300 hover:bg-green-500/30 transition-all"
                >📊 Dashboard</a>
            </div>
        </div>
    );
};

export default Popup;
