// ============================================================
// API client — fetch wrapper for Next.js API backend
// ============================================================

const API_BASE = 'http://localhost:3000/api';

/* ── Types ────────────────────────────────────────────────── */

export type SimplifyMode =
    | 'simplify'
    | 'summarize'
    | 'breakdown'
    | 'bullet_summary'
    | 'key_takeaways'
    | 'rephrase'
    | 'academic_to_plain'
    | 'explain_sentence'
    | 'mindmap';

export interface SimplifyRequest {
    text: string;
    mode: SimplifyMode;
    level?: 1 | 2 | 3;
    context?: string;
}

export interface SimplifyResponse {
    result: string;
    mindmapData?: any;
    error?: string;
}

export interface DefineRequest {
    word: string;
    context?: string;
}

export interface DefineResponse {
    definition: string;
    pronunciation: string;
    example: string;
    synonyms: string[];
    analogy: string;
    is_abbreviation: boolean;
    expanded_form: string;
    error?: string;
}

export interface ReadingLevelResponse {
    gradeLevel: number;
    readingEase: number;
    difficulty: string;
    color: string;
    wordCount: number;
    sentenceCount: number;
    avgSyllablesPerWord: number;
    suggestSimplify: boolean;
    error?: string;
}

/* ── Messaging Helper ───────────────────────────────────────── */

/**
 * Proxy fetch through service worker to bypass CORS/CSP/Mixed-Content
 */
async function chromeFetch(type: string, payload: any): Promise<any> {
    if (typeof chrome !== 'undefined' && chrome.runtime && chrome.runtime.sendMessage) {
        return new Promise((resolve) => {
            chrome.runtime.sendMessage({ type, ...payload }, (res) => {
                if (chrome.runtime.lastError) {
                    resolve({ error: `Connection failed: ${chrome.runtime.lastError.message}` });
                } else {
                    resolve(res);
                }
            });
        });
    }
    return { error: 'Messaging system not available' };
}

/* ── API Functions ─────────────────────────────────────────── */

/**
 * Send text to AI for simplification etc.
 */
export async function simplifyText(req: SimplifyRequest): Promise<SimplifyResponse> {
    // If in content script, proxy via messaging
    if (typeof document !== 'undefined') {
        return await chromeFetch('API_SIMPLIFY', { req });
    }

    // If in service worker, do actual fetch
    try {
        const res = await fetch(`${API_BASE}/simplify`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(req),
        });
        if (!res.ok) throw new Error(`API error: ${res.status}`);
        return await res.json();
    } catch (err: any) {
        return { result: '', error: err.message || 'Failed to simplify text' };
    }
}

/**
 * Get a rich definition for a word
 */
export async function defineWord(req: DefineRequest): Promise<DefineResponse> {
    if (typeof document !== 'undefined') {
        return await chromeFetch('API_DEFINE', { req });
    }

    try {
        const res = await fetch(`${API_BASE}/define`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(req),
        });
        if (!res.ok) throw new Error(`API error: ${res.status}`);
        return await res.json();
    } catch (err: any) {
        return {
            definition: '', pronunciation: '', example: '', synonyms: [], analogy: '',
            is_abbreviation: false, expanded_form: '',
            error: err.message || 'Failed to define word'
        };
    }
}

/**
 * Analyze reading level
 */
export async function analyzeReadingLevel(text: string): Promise<ReadingLevelResponse> {
    if (typeof document !== 'undefined') {
        return await chromeFetch('API_READING_LEVEL', { text });
    }

    try {
        const res = await fetch(`${API_BASE}/reading-level`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ text }),
        });
        if (!res.ok) throw new Error(`API error: ${res.status}`);
        return await res.json();
    } catch (err: any) {
        return {
            gradeLevel: 0, readingEase: 0, difficulty: 'Unknown', color: 'gray',
            wordCount: 0, sentenceCount: 0, avgSyllablesPerWord: 0,
            suggestSimplify: false, error: err.message || 'Failed to analyze'
        };
    }
}
