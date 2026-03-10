'use client';

/* eslint-disable @typescript-eslint/no-explicit-any */
declare const chrome: any;

import React, { useState, useEffect } from 'react';

/* ── Types ────────────────────────────────────────────────── */

interface ProgressData {
    totalSessions: number;
    totalWordsRead: number;
    totalTimeMinutes: number;
    confusedWordsMap: Record<string, number>;
    dailyStats: Record<string, { words: number; minutes: number; sessions: number }>;
    streakDays: number;
    lastActiveDate: string;
}

interface ReadingSession {
    url: string;
    title: string;
    startTime: number;
    endTime?: number;
    wordsRead: number;
    confusedWords: string[];
    date: string;
}

const defaultProgress: ProgressData = {
    totalSessions: 0, totalWordsRead: 0, totalTimeMinutes: 0,
    confusedWordsMap: {}, dailyStats: {}, streakDays: 0, lastActiveDate: '',
};

/* ── Encouragement messages ───────────────────────────────── */

const ENCOURAGEMENTS = [
    "📚 Every word you read is a step forward!",
    "🌟 You're doing amazing — keep going!",
    "💪 Reading is a superpower — and you're getting stronger!",
    "🧠 Your brain is building new pathways every time you read!",
    "🎯 Progress, not perfection!",
    "🏆 You've come so far — be proud!",
    "🌈 Dyslexia is a different way of thinking — it's your strength!",
    "⭐ Every struggle you overcome makes you more resilient!",
];

/* ── Components ───────────────────────────────────────────── */

function StatCard({ icon, label, value, sub }: { icon: string; label: string; value: string | number; sub?: string }) {
    return (
        <div className="p-4 rounded-2xl border border-white/10 bg-white/5 backdrop-blur-lg hover:bg-white/10 transition-all">
            <div className="text-2xl mb-1">{icon}</div>
            <div className="text-2xl font-bold text-white">{value}</div>
            <div className="text-xs text-gray-400">{label}</div>
            {sub && <div className="text-xs text-blue-400 mt-1">{sub}</div>}
        </div>
    );
}

function BarChart({ data, days = 7 }: { data: Record<string, { words: number; minutes: number }>; days?: number }) {
    const entries = [];
    for (let i = days - 1; i >= 0; i--) {
        const date = new Date(Date.now() - i * 86400000).toISOString().slice(0, 10);
        const dayLabel = new Date(date).toLocaleDateString('en', { weekday: 'short' });
        entries.push({ date, dayLabel, words: data[date]?.words || 0, minutes: data[date]?.minutes || 0 });
    }
    const maxWords = Math.max(...entries.map(e => e.words), 1);

    return (
        <div className="space-y-2">
            <div className="flex items-end justify-between h-32 gap-1">
                {entries.map(({ date, dayLabel, words }) => (
                    <div key={date} className="flex-1 flex flex-col items-center">
                        <div className="text-[10px] text-gray-500 mb-1">{words > 0 ? words : ''}</div>
                        <div
                            className="w-full rounded-t-md transition-all"
                            style={{
                                height: `${Math.max((words / maxWords) * 100, 4)}%`,
                                background: words > 0
                                    ? 'linear-gradient(to top, #4A90D9, #7B68EE)'
                                    : 'rgba(255,255,255,0.05)',
                            }}
                        />
                    </div>
                ))}
            </div>
            <div className="flex justify-between">
                {entries.map(({ date, dayLabel }) => (
                    <div key={date} className="flex-1 text-center text-[10px] text-gray-500">{dayLabel}</div>
                ))}
            </div>
        </div>
    );
}

/* ── Extension bridge ─────────────────────────────────────── */

const EXTENSION_ID_KEY = 'acrc_extension_id';

function getExtensionId(): string | null {
    try { return localStorage.getItem(EXTENSION_ID_KEY); } catch { return null; }
}

function sendToExtension<T>(extensionId: string, message: any): Promise<T | null> {
    return new Promise((resolve) => {
        try {
            if (typeof chrome !== 'undefined' && chrome.runtime?.sendMessage) {
                chrome.runtime.sendMessage(extensionId, message, (response: T) => {
                    if (chrome.runtime.lastError) {
                        resolve(null);
                    } else {
                        resolve(response || null);
                    }
                });
            } else {
                resolve(null);
            }
        } catch {
            resolve(null);
        }
    });
}

async function fetchProgress(): Promise<ProgressData> {
    // Try extension first
    const extId = getExtensionId();
    if (extId) {
        const data = await sendToExtension<ProgressData>(extId, { type: 'GET_PROGRESS' });
        if (data && data.totalSessions !== undefined) {
            // Also save to localStorage as cache
            try { localStorage.setItem('acrc_progress', JSON.stringify(data)); } catch { }
            return data;
        }
    }
    // Fallback to localStorage
    try {
        const stored = localStorage.getItem('acrc_progress');
        if (stored) return JSON.parse(stored);
    } catch { /* ignore */ }
    return defaultProgress;
}

async function fetchHistory(): Promise<ReadingSession[]> {
    // Try extension first
    const extId = getExtensionId();
    if (extId) {
        const data = await sendToExtension<ReadingSession[]>(extId, { type: 'GET_HISTORY' });
        if (data && Array.isArray(data)) {
            try { localStorage.setItem('acrc_reading_history', JSON.stringify(data)); } catch { }
            return data;
        }
    }
    // Fallback to localStorage
    try {
        const stored = localStorage.getItem('acrc_reading_history');
        if (stored) return JSON.parse(stored);
    } catch { /* ignore */ }
    return [];
}

/* ── Page ─────────────────────────────────────────────────── */

export default function DashboardPage() {
    const [progress, setProgress] = useState<ProgressData>(defaultProgress);
    const [history, setHistory] = useState<ReadingSession[]>([]);
    const [tab, setTab] = useState<'overview' | 'history' | 'words' | 'settings'>('overview');
    const [encouragement, setEncouragement] = useState(ENCOURAGEMENTS[0]);
    const [extensionId, setExtensionId] = useState(getExtensionId() || '');
    const [connected, setConnected] = useState(false);
    const [aiInsight, setAiInsight] = useState<string | null>(null);
    const [isSyncing, setIsSyncing] = useState(false);

    useEffect(() => {
        setEncouragement(ENCOURAGEMENTS[Math.floor(Math.random() * ENCOURAGEMENTS.length)]);
    }, []);

    useEffect(() => {
        fetchProgress().then((data) => {
            setProgress(data);
            setConnected(data.totalSessions > 0 || !!getExtensionId());
        });
        fetchHistory().then(setHistory);
    }, []);

    const syncProfile = async (data: ProgressData, extId: string) => {
        if (!extId || data.totalSessions === 0) return;
        setIsSyncing(true);
        try {
            const res = await fetch('/api/profile', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ extensionId: extId, progressData: data })
            });
            if (res.ok) {
                const result = await res.json();
                if (result.aiInsight) setAiInsight(result.aiInsight);
            }
        } catch (e) {
            console.error('Profile sync failed', e);
        } finally {
            setIsSyncing(false);
        }
    };

    // Auto-sync if we have data and ID on load
    useEffect(() => {
        if (connected && extensionId && progress.totalSessions > 0 && !aiInsight) {
            syncProfile(progress, extensionId);
        }
    }, [connected, extensionId, progress.totalSessions]);

    // Top confused words sorted by frequency
    const confusedWords = Object.entries(progress.confusedWordsMap)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 20);

    return (
        <main className="max-w-5xl mx-auto px-4 py-8 space-y-6">
            {/* Hero */}
            <section className="text-center space-y-2">
                <h1 className="text-3xl font-bold bg-gradient-to-r from-blue-400 via-purple-400 to-pink-400 bg-clip-text text-transparent">
                    Your Reading Journey
                </h1>
                <p className="text-gray-400 text-sm max-w-md mx-auto">{encouragement}</p>
            </section>

            {/* Stats */}
            <section className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <StatCard icon="📖" label="Sessions" value={progress.totalSessions} />
                <StatCard icon="📝" label="Words Read" value={progress.totalWordsRead.toLocaleString()} />
                <StatCard icon="⏱️" label="Time" value={`${Math.round(progress.totalTimeMinutes)}m`} />
                <StatCard icon="🔥" label="Streak" value={`${progress.streakDays} day${progress.streakDays !== 1 ? 's' : ''}`} />
            </section>

            {/* Tab navigation */}
            <div className="flex gap-2 border-b border-white/10 pb-2">
                {[
                    { id: 'overview' as const, icon: '📊', label: 'Overview' },
                    { id: 'history' as const, icon: '📜', label: 'History' },
                    { id: 'words' as const, icon: '🔤', label: 'Tricky Words' },
                    { id: 'settings' as const, icon: '⚙️', label: 'Settings' },
                ].map(({ id, icon, label }) => (
                    <button
                        key={id}
                        onClick={() => setTab(id)}
                        className={`px-4 py-2 rounded-xl text-sm transition-all ${tab === id
                            ? 'bg-blue-500/20 text-blue-300 border border-blue-500/30'
                            : 'text-gray-400 hover:bg-white/5'
                            }`}
                    >{icon} {label}</button>
                ))}
            </div>

            {/* ─── Overview Tab ─── */}
            {tab === 'overview' && (
                <section className="space-y-6">
                    <div className="p-5 rounded-2xl border border-white/10 bg-white/5 backdrop-blur-lg">
                        <h3 className="text-sm font-semibold text-gray-300 mb-3">Words Read (Last 7 Days)</h3>
                        <BarChart data={progress.dailyStats} />
                    </div>

                    {/* AI Learning Profile Insight */}
                    {aiInsight && (
                        <div className="p-5 rounded-2xl border border-purple-500/30 bg-purple-500/10 backdrop-blur-lg relative overflow-hidden">
                            <div className="absolute top-0 right-0 w-32 h-32 bg-purple-500/20 blur-3xl rounded-full translate-x-1/2 -translate-y-1/2 opacity-50" />
                            <h3 className="text-sm font-semibold text-purple-300 mb-2 flex items-center gap-2">
                                🧠 AI Learning Profile Insight
                            </h3>
                            <p className="text-sm text-gray-200 leading-relaxed relative z-10">
                                {aiInsight}
                            </p>
                        </div>
                    )}

                    {/* Milestones */}
                    <div className="p-5 rounded-2xl border border-white/10 bg-white/5 backdrop-blur-lg">
                        <h3 className="text-sm font-semibold text-gray-300 mb-3">🏆 Milestones</h3>
                        <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                            {[
                                { emoji: '📖', title: 'First Read', goal: 1, current: progress.totalSessions },
                                { emoji: '💯', title: '100 Words', goal: 100, current: progress.totalWordsRead },
                                { emoji: '🔥', title: '3 Day Streak', goal: 3, current: progress.streakDays },
                                { emoji: '📚', title: '1000 Words', goal: 1000, current: progress.totalWordsRead },
                                { emoji: '⚡', title: '10 Sessions', goal: 10, current: progress.totalSessions },
                                { emoji: '🏔️', title: '5000 Words', goal: 5000, current: progress.totalWordsRead },
                            ].map(({ emoji, title, goal, current }) => {
                                const done = current >= goal;
                                return (
                                    <div key={title} className={`p-3 rounded-xl border text-center ${done ? 'bg-green-500/10 border-green-500/30' : 'bg-white/5 border-white/10 opacity-50'
                                        }`}>
                                        <div className="text-xl">{done ? emoji : '🔒'}</div>
                                        <div className="text-xs font-medium mt-1">
                                            {title}
                                        </div>
                                        <div className="text-[10px] text-gray-500 mt-0.5">
                                            {done ? '✅ Unlocked!' : `${current}/${goal}`}
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                </section>
            )}

            {/* ─── History Tab ─── */}
            {tab === 'history' && (
                <section className="p-5 rounded-2xl border border-white/10 bg-white/5 backdrop-blur-lg">
                    <h3 className="text-sm font-semibold text-gray-300 mb-3">📜 Reading History</h3>
                    {history.length === 0 ? (
                        <p className="text-center text-gray-500 py-8 text-sm">No reading sessions yet. Start reading to see your history!</p>
                    ) : (
                        <div className="space-y-2 max-h-96 overflow-y-auto">
                            {history.slice(0, 50).map((s, i) => (
                                <div key={i} className="flex items-center gap-3 p-3 rounded-xl bg-white/5 hover:bg-white/10 transition-all">
                                    <div className="text-xl">📖</div>
                                    <div className="flex-1 min-w-0">
                                        <div className="text-sm font-medium truncate">{s.title || 'Untitled page'}</div>
                                        <div className="text-xs text-gray-500 truncate">{s.url}</div>
                                    </div>
                                    <div className="text-right">
                                        <div className="text-xs text-blue-400">{s.wordsRead} words</div>
                                        <div className="text-[10px] text-gray-500">{s.date}</div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </section>
            )}

            {/* ─── Tricky Words Tab ─── */}
            {tab === 'words' && (
                <section className="p-5 rounded-2xl border border-white/10 bg-white/5 backdrop-blur-lg">
                    <h3 className="text-sm font-semibold text-gray-300 mb-3">🔤 Most Frequently Confused Words</h3>
                    {confusedWords.length === 0 ? (
                        <p className="text-center text-gray-500 py-8 text-sm">No tricky words recorded yet. The extension tracks words you struggle with.</p>
                    ) : (
                        <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                            {confusedWords.map(([word, count]) => (
                                <div key={word} className="flex items-center justify-between p-3 rounded-xl bg-white/5 hover:bg-white/10 transition-all">
                                    <span className="text-sm font-medium">{word}</span>
                                    <span className="text-xs text-orange-400 bg-orange-500/10 px-2 py-0.5 rounded-full">{count}×</span>
                                </div>
                            ))}
                        </div>
                    )}
                </section>
            )}

            {/* ─── Settings Tab ─── */}
            {tab === 'settings' && (
                <section className="p-5 rounded-2xl border border-white/10 bg-white/5 backdrop-blur-lg space-y-4">
                    <h3 className="text-sm font-semibold text-gray-300 mb-3">⚙️ Settings & Privacy</h3>

                    <div className="space-y-3">
                        {/* Extension Connect */}
                        <div className="p-4 rounded-xl bg-green-500/10 border border-green-500/20">
                            <h4 className="text-sm font-semibold text-green-300">🔗 Connect Extension</h4>
                            <p className="text-xs text-gray-400 mt-1 mb-2">
                                {connected
                                    ? '✅ Extension connected — data syncs automatically.'
                                    : 'Enter your extension ID from chrome://extensions to sync reading data.'}
                            </p>
                            <div className="flex gap-2">
                                <input
                                    type="text"
                                    value={extensionId}
                                    onChange={(e) => setExtensionId(e.target.value)}
                                    placeholder="Extension ID (e.g. abcde...)"
                                    className="flex-1 px-3 py-2 text-xs rounded-lg bg-white/5 border border-white/10 text-white placeholder-gray-500 outline-none focus:border-green-500/50"
                                />
                                <button
                                    onClick={() => {
                                        if (extensionId.trim()) {
                                            localStorage.setItem(EXTENSION_ID_KEY, extensionId.trim());
                                            fetchProgress().then((data) => {
                                                setProgress(data);
                                                setConnected(data.totalSessions > 0);
                                            });
                                            fetchHistory().then(setHistory);
                                        }
                                    }}
                                    className="px-4 py-2 text-xs rounded-lg bg-green-500/20 border border-green-500/30 text-green-300 hover:bg-green-500/30 transition-all"
                                >Sync</button>
                            </div>
                        </div>

                        <div className="p-4 rounded-xl bg-blue-500/10 border border-blue-500/20">
                            <h4 className="text-sm font-semibold text-blue-300">🔒 Privacy</h4>
                            <p className="text-xs text-gray-400 mt-1">All AI processing runs locally. No data leaves your computer. Reading logs are stored only in your browser.</p>
                        </div>

                        <div className="p-4 rounded-xl bg-purple-500/10 border border-purple-500/20">
                            <h4 className="text-sm font-semibold text-purple-300">🧠 AI Model</h4>
                            <p className="text-xs text-gray-400 mt-1">Currently using <strong>Llama 3</strong> via Ollama (local). You can switch models by updating your Ollama configuration.</p>
                        </div>

                        <button
                            onClick={() => {
                                localStorage.removeItem('acrc_progress');
                                localStorage.removeItem('acrc_reading_history');
                                setProgress(defaultProgress);
                                setHistory([]);
                            }}
                            className="w-full p-3 rounded-xl bg-red-500/10 border border-red-500/30 text-red-400 text-sm hover:bg-red-500/20 transition-all"
                        >
                            🗑️ Clear All Data
                        </button>
                    </div>
                </section>
            )}
        </main>
    );
}
