// ============================================================
// Service Worker — MV3 background script with session tracking
// ============================================================

import { DEFAULT_PREFERENCES, Preferences } from '../lib/constants';
import { simplifyText, defineWord, analyzeReadingLevel } from '../lib/api';

/* ── Types ────────────────────────────────────────────────── */

interface ReadingSession {
    url: string;
    title: string;
    startTime: number;
    endTime?: number;
    wordsRead: number;
    confusedWords: string[];
    date: string; // YYYY-MM-DD
}

interface ProgressData {
    totalSessions: number;
    totalWordsRead: number;
    totalTimeMinutes: number;
    confusedWordsMap: Record<string, number>; // word → frequency
    dailyStats: Record<string, { words: number; minutes: number; sessions: number }>;
    streakDays: number;
    lastActiveDate: string;
}

/* ── Initialize defaults on install ───────────────────────── */

chrome.runtime.onInstalled.addListener(() => {
    // Always reset prefs to latest defaults on install/update.
    // This clears old stale prefs (e.g. darkMode, letterSpacing)
    // that could break page layout.
    chrome.storage.local.set({ acrc_prefs: DEFAULT_PREFERENCES });

    chrome.storage.local.get('acrc_progress', (data) => {
        if (!data.acrc_progress) {
            const initial: ProgressData = {
                totalSessions: 0,
                totalWordsRead: 0,
                totalTimeMinutes: 0,
                confusedWordsMap: {},
                dailyStats: {},
                streakDays: 0,
                lastActiveDate: '',
            };
            chrome.storage.local.set({ acrc_progress: initial });
        }
    });

    chrome.storage.local.get('acrc_reading_history', (data) => {
        if (!data.acrc_reading_history) {
            chrome.storage.local.set({ acrc_reading_history: [] });
        }
    });

    console.log('[ACRC] Extension installed — defaults initialized');
});

/* ── Message handlers ─────────────────────────────────────── */

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.type === 'SESSION_END') {
        handleSessionEnd(message.session).then(() => sendResponse({ ok: true }));
        return true; // async response
    }

    if (message.type === 'CONFUSED_WORD') {
        trackConfusedWord(message.word).then(() => sendResponse({ ok: true }));
        return true;
    }

    if (message.type === 'GET_PROGRESS') {
        chrome.storage.local.get('acrc_progress', (data) => {
            sendResponse(data.acrc_progress || {});
        });
        return true;
    }

    if (message.type === 'GET_HISTORY') {
        chrome.storage.local.get('acrc_reading_history', (data) => {
            sendResponse(data.acrc_reading_history || []);
        });
        return true;
    }

    if (message.type === 'API_SIMPLIFY') {
        simplifyText(message.req).then(sendResponse);
        return true;
    }

    if (message.type === 'API_DEFINE') {
        defineWord(message.req).then(sendResponse);
        return true;
    }

    if (message.type === 'API_READING_LEVEL') {
        analyzeReadingLevel(message.text).then(sendResponse);
        return true;
    }
});

/* ── External message handlers (for web dashboard) ────────── */

chrome.runtime.onMessageExternal.addListener((message, sender, sendResponse) => {
    if (message.type === 'GET_PROGRESS') {
        chrome.storage.local.get('acrc_progress', (data) => {
            sendResponse(data.acrc_progress || {});
        });
        return true;
    }

    if (message.type === 'GET_HISTORY') {
        chrome.storage.local.get('acrc_reading_history', (data) => {
            sendResponse(data.acrc_reading_history || []);
        });
        return true;
    }
});

/* ── Session tracking ─────────────────────────────────────── */

async function handleSessionEnd(session: ReadingSession) {
    const durationMinutes = session.endTime
        ? (session.endTime - session.startTime) / 60000
        : 0;

    // Update history
    const historyData = await chrome.storage.local.get('acrc_reading_history');
    const history: ReadingSession[] = historyData.acrc_reading_history || [];
    history.unshift(session);
    if (history.length > 100) history.length = 100; // cap
    await chrome.storage.local.set({ acrc_reading_history: history });

    // Update progress
    const progressData = await chrome.storage.local.get('acrc_progress');
    const progress: ProgressData = progressData.acrc_progress || {
        totalSessions: 0,
        totalWordsRead: 0,
        totalTimeMinutes: 0,
        confusedWordsMap: {},
        dailyStats: {},
        streakDays: 0,
        lastActiveDate: '',
    };

    progress.totalSessions++;
    progress.totalWordsRead += session.wordsRead;
    progress.totalTimeMinutes += durationMinutes;

    // Daily stats
    const today = session.date || new Date().toISOString().slice(0, 10);
    if (!progress.dailyStats[today]) {
        progress.dailyStats[today] = { words: 0, minutes: 0, sessions: 0 };
    }
    progress.dailyStats[today].words += session.wordsRead;
    progress.dailyStats[today].minutes += durationMinutes;
    progress.dailyStats[today].sessions++;

    // Streak
    if (progress.lastActiveDate !== today) {
        const yesterday = new Date(Date.now() - 86400000).toISOString().slice(0, 10);
        progress.streakDays = progress.lastActiveDate === yesterday ? progress.streakDays + 1 : 1;
        progress.lastActiveDate = today;
    }

    // Confused words
    for (const word of session.confusedWords) {
        const key = word.toLowerCase();
        progress.confusedWordsMap[key] = (progress.confusedWordsMap[key] || 0) + 1;
    }

    await chrome.storage.local.set({ acrc_progress: progress });
}

async function trackConfusedWord(word: string) {
    const progressData = await chrome.storage.local.get('acrc_progress');
    const progress: ProgressData = progressData.acrc_progress || {
        totalSessions: 0, totalWordsRead: 0, totalTimeMinutes: 0,
        confusedWordsMap: {}, dailyStats: {}, streakDays: 0, lastActiveDate: '',
    };
    const key = word.toLowerCase();
    progress.confusedWordsMap[key] = (progress.confusedWordsMap[key] || 0) + 1;
    await chrome.storage.local.set({ acrc_progress: progress });
}
