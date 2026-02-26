// ============================================================
// Popup.tsx — Extension popup with all features in OpenDyslexia
// ============================================================

import React, { useState, useEffect } from 'react';
import { DEFAULT_PREFERENCES, Preferences } from '../lib/constants';

const Popup: React.FC = () => {
    const [prefs, setPrefs] = useState<Preferences>(DEFAULT_PREFERENCES);
    const [statusMsg, setStatusMsg] = useState('');

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

    const showStatus = (msg: string) => {
        setStatusMsg(msg);
        setTimeout(() => setStatusMsg(''), 3000);
    };

    // Send action to content script via messaging
    const sendToContent = (action: string) => {
        chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
            if (!tabs[0]?.id) return;
            chrome.tabs.sendMessage(tabs[0].id, { type: 'ACRC_ACTION', action }, (response) => {
                if (chrome.runtime.lastError) {
                    showStatus('⚠️ Refresh the page first');
                } else {
                    showStatus(response?.message || `✅ ${action} activated`);
                }
            });
        });
    };

    const fontStyle: React.CSSProperties = {
        fontFamily: "'OpenDyslexic', 'Comic Sans MS', cursive",
    };

    const Toggle: React.FC<{ checked: boolean; onChange: (v: boolean) => void; label: string; icon: string }> = ({ checked, onChange, label, icon }) => (
        <div className="flex items-center justify-between p-2.5 rounded-xl bg-white/5 border border-white/8 hover:bg-white/8 transition-all" style={fontStyle}>
            <span className="text-sm flex items-center gap-2">
                <span className="text-base">{icon}</span> {label}
            </span>
            <label className="relative inline-flex items-center cursor-pointer">
                <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} className="sr-only peer" />
                <div className="w-10 h-5 bg-gray-600 rounded-full peer peer-checked:after:translate-x-full after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-blue-500"></div>
            </label>
        </div>
    );

    const FeatureBtn: React.FC<{ icon: string; label: string; action: string; color: string }> = ({ icon, label, action, color }) => (
        <button
            onClick={() => sendToContent(action)}
            className="flex flex-col items-center justify-center p-3 rounded-xl border border-white/10 hover:border-blue-500/40 transition-all hover:scale-[1.03] active:scale-95"
            style={{
                ...fontStyle,
                background: `linear-gradient(135deg, ${color}15 0%, ${color}08 100%)`,
            }}
        >
            <span className="text-xl mb-1">{icon}</span>
            <span className="text-[10px] font-bold text-gray-300 tracking-wide">{label}</span>
        </button>
    );

    return (
        <div className="p-3 space-y-3 text-white overflow-y-auto" style={{ ...fontStyle, width: '380px', maxHeight: '580px', background: 'linear-gradient(135deg, #0f0c29, #1a1a2e)' }}>
            {/* Header */}
            <div className="text-center space-y-1 pb-1">
                <div className="text-2xl">📖</div>
                <h1 className="text-lg font-bold" style={{ ...fontStyle, background: 'linear-gradient(90deg, #4A90D9, #7B68EE)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
                    Reading Companion
                </h1>
                <p className="text-[10px] text-gray-400" style={fontStyle}>
                    OpenDyslexia font · Word magnifier · Smart help
                </p>
            </div>

            {/* Master Toggle */}
            <div className="flex items-center justify-between p-3 rounded-xl bg-gradient-to-r from-blue-500/10 to-purple-500/10 border border-blue-500/20" style={fontStyle}>
                <span className="text-sm font-bold">🟢 Enable Extension</span>
                <label className="relative inline-flex items-center cursor-pointer">
                    <input type="checkbox" checked={prefs.enabled} onChange={(e) => updatePref('enabled', e.target.checked)} className="sr-only peer" />
                    <div className="w-11 h-6 bg-gray-600 rounded-full peer peer-checked:after:translate-x-full after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-green-500"></div>
                </label>
            </div>

            {/* Active Features */}
            <div className="space-y-1.5">
                <h3 className="text-[10px] font-bold text-gray-400 uppercase tracking-widest px-1" style={fontStyle}>Active Features</h3>
                <Toggle checked={prefs.highlightOnHover} onChange={(v) => updatePref('highlightOnHover', v)} label="Word Magnifier" icon="🔍" />
                <Toggle checked={prefs.struggleDetectionEnabled} onChange={(v) => updatePref('struggleDetectionEnabled', v)} label="Struggle Detection" icon="🧠" />
                <Toggle checked={prefs.privacyAIEnabled} onChange={(v) => updatePref('privacyAIEnabled', v)} label="AI Processing" icon="🤖" />
            </div>

            {/* Feature Tools — available when user struggles or selects text */}
            <div className="space-y-1.5">
                <h3 className="text-[10px] font-bold text-gray-400 uppercase tracking-widest px-1" style={fontStyle}>
                    Tools <span className="text-gray-500 normal-case">(select text → use)</span>
                </h3>
                <div className="grid grid-cols-4 gap-1.5">
                    <FeatureBtn icon="🔊" label="Read Aloud" action="speak" color="#4A90D9" />
                    <FeatureBtn icon="💡" label="Define" action="define" color="#52B788" />
                    <FeatureBtn icon="📖" label="Simplify" action="simplify" color="#F4A261" />
                    <FeatureBtn icon="🧠" label="Explain" action="explain_sentence" color="#7B68EE" />
                    <FeatureBtn icon="🗺️" label="Mindmap" action="mindmap" color="#E76F51" />
                    <FeatureBtn icon="✂️" label="Break Down" action="breakdown" color="#FF6B9D" />
                    <FeatureBtn icon="🔄" label="Rephrase" action="rephrase" color="#06D6A0" />
                    <FeatureBtn icon="📋" label="Summary" action="bullet_summary" color="#118AB2" />
                </div>
            </div>

            {/* Simplification Level */}
            <div className="space-y-1.5">
                <h3 className="text-[10px] font-bold text-gray-400 uppercase tracking-widest px-1" style={fontStyle}>Simplification Level</h3>
                <div className="grid grid-cols-3 gap-1.5">
                    {([1, 2, 3] as const).map(l => (
                        <button key={l} onClick={() => updatePref('simplificationLevel', l)}
                            className={`p-2 text-xs rounded-xl border transition-all font-bold ${prefs.simplificationLevel === l
                                ? 'bg-blue-500/25 border-blue-500/50 text-blue-300 shadow-lg shadow-blue-500/10'
                                : 'bg-white/5 border-white/10 text-gray-400 hover:bg-white/10'}`}
                            style={fontStyle}
                        >{l === 1 ? '🟢 Easy' : l === 2 ? '🟡 Simpler' : '🔴 Simplest'}</button>
                    ))}
                </div>
            </div>

            {/* TTS Settings */}
            <div className="space-y-2">
                <h3 className="text-[10px] font-bold text-gray-400 uppercase tracking-widest px-1" style={fontStyle}>Text-to-Speech</h3>
                <div className="flex items-center gap-3 p-2 rounded-xl bg-white/5" style={fontStyle}>
                    <span className="text-xs text-gray-400 w-12">Speed</span>
                    <input type="range" min={0.5} max={2} step={0.1} value={prefs.ttsRate}
                        onChange={(e) => updatePref('ttsRate', parseFloat(e.target.value))}
                        className="flex-1 h-1 bg-gray-700 rounded-lg appearance-none cursor-pointer accent-blue-500" />
                    <span className="text-xs text-blue-400 w-8 text-right">{prefs.ttsRate.toFixed(1)}x</span>
                </div>
                <div className="flex items-center gap-3 p-2 rounded-xl bg-white/5" style={fontStyle}>
                    <span className="text-xs text-gray-400 w-12">Pitch</span>
                    <input type="range" min={0.5} max={2} step={0.1} value={prefs.ttsPitch}
                        onChange={(e) => updatePref('ttsPitch', parseFloat(e.target.value))}
                        className="flex-1 h-1 bg-gray-700 rounded-lg appearance-none cursor-pointer accent-blue-500" />
                    <span className="text-xs text-blue-400 w-8 text-right">{prefs.ttsPitch.toFixed(1)}</span>
                </div>
            </div>

            {/* Status message */}
            {statusMsg && (
                <div className="p-2 rounded-xl bg-blue-500/15 border border-blue-500/25 text-xs text-blue-300 text-center animate-pulse" style={fontStyle}>
                    {statusMsg}
                </div>
            )}

            {/* How to use */}
            <div className="p-2.5 rounded-xl bg-gradient-to-r from-blue-500/8 to-purple-500/8 border border-white/8 text-[10px] text-gray-400 leading-relaxed" style={fontStyle}>
                <strong className="text-blue-300">How to use:</strong><br />
                ✦ Hover over words to magnify them<br />
                ✦ Stay on a word 2s for AI help<br />
                ✦ Select text → click tools above<br />
                ✦ Click the 💡 bubble for full popup
            </div>

            {/* Quick links */}
            <div className="flex gap-2">
                <a href="http://localhost:3000/scanner" target="_blank" rel="noreferrer"
                    className="flex-1 p-2.5 text-center text-xs rounded-xl bg-gradient-to-r from-blue-500/15 to-purple-500/15 border border-blue-500/25 text-blue-300 hover:bg-blue-500/25 transition-all font-bold"
                    style={fontStyle}
                >📷 Scanner</a>
                <a href="http://localhost:3000/dashboard" target="_blank" rel="noreferrer"
                    className="flex-1 p-2.5 text-center text-xs rounded-xl bg-gradient-to-r from-green-500/15 to-teal-500/15 border border-green-500/25 text-green-300 hover:bg-green-500/25 transition-all font-bold"
                    style={fontStyle}
                >📊 Dashboard</a>
            </div>
        </div>
    );
};

export default Popup;
