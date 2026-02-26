// ============================================================
// StruggleDetector.ts — detects reading difficulty patterns
// Uses VirtualCursor for zero-DOM-mutation word detection
// ============================================================

import { VirtualCursor, WordAtPoint } from './VirtualCursor';

export type StruggleType = 'stuck' | 're-reading' | 'paused' | 'selection';

export interface StruggleEvent {
    type: StruggleType;
    word: string;
    element: HTMLElement | null;
    timestamp: number;
    rect?: DOMRect;
    sentence?: string;
    context?: string;
}

type StruggleCallback = (event: StruggleEvent) => void;

const HOVER_THRESHOLD_MS = 2000;      // Stuck on a word
const SCROLL_BACK_WINDOW_MS = 5000;   // Re-reading detection window
const SCROLL_BACK_COUNT = 3;          // Scroll-ups needed to trigger
const IDLE_THRESHOLD_MS = 8000;       // Paused too long

export class StruggleDetector {
    private onStruggle: StruggleCallback;
    private virtualCursor: VirtualCursor;
    private scrollBackTimes: number[] = [];
    private lastScrollY: number = 0;
    private idleTimer: ReturnType<typeof setTimeout> | null = null;
    private hoverTimer: ReturnType<typeof setTimeout> | null = null;
    private currentWord: WordAtPoint | null = null;
    private dismissedWords: Set<string> = new Set();
    private active: boolean = false;

    constructor(callback: StruggleCallback, virtualCursor: VirtualCursor) {
        this.onStruggle = callback;
        this.virtualCursor = virtualCursor;
    }

    start(): void {
        if (this.active) return;
        this.active = true;
        document.addEventListener('mousemove', this.handleMouseMove);
        document.addEventListener('scroll', this.handleScroll);
        document.addEventListener('keydown', this.resetIdle);
        this.startIdleTimer();
    }

    stop(): void {
        this.active = false;
        document.removeEventListener('mousemove', this.handleMouseMove);
        document.removeEventListener('scroll', this.handleScroll);
        document.removeEventListener('keydown', this.resetIdle);
        this.clearAllTimers();
    }

    dismissWord(word: string): void {
        this.dismissedWords.add(word.toLowerCase());
    }

    private handleMouseMove = (e: MouseEvent): void => {
        const wordInfo = this.virtualCursor.getWordAtPoint(e.clientX, e.clientY);

        if (!wordInfo) {
            // Cursor is not over a word — clear hover timer
            if (this.hoverTimer) {
                clearTimeout(this.hoverTimer);
                this.hoverTimer = null;
            }
            this.currentWord = null;
            this.resetIdle();
            return;
        }

        const newWordKey = wordInfo.word.toLowerCase();

        // Same word as before — let the timer run
        if (this.currentWord && this.currentWord.word.toLowerCase() === newWordKey) {
            this.resetIdle();
            return;
        }

        // Different word — reset hover timer
        if (this.hoverTimer) {
            clearTimeout(this.hoverTimer);
            this.hoverTimer = null;
        }

        this.currentWord = wordInfo;
        this.resetIdle();

        if (this.dismissedWords.has(newWordKey)) return;

        // Start a new hover timer for this word
        this.hoverTimer = setTimeout(() => {
            if (!this.currentWord) return;
            this.onStruggle({
                type: 'stuck',
                word: this.currentWord.word,
                element: this.currentWord.textNode.parentElement,
                timestamp: Date.now(),
                rect: this.currentWord.rect,
                sentence: this.currentWord.sentence,
                context: this.currentWord.context,
            });
        }, HOVER_THRESHOLD_MS);
    };

    private handleScroll = (): void => {
        const currentY = window.scrollY;
        if (currentY < this.lastScrollY) {
            // Scrolling up — potential re-reading
            const now = Date.now();
            this.scrollBackTimes.push(now);

            // Clean old entries
            this.scrollBackTimes = this.scrollBackTimes.filter(
                (t) => now - t < SCROLL_BACK_WINDOW_MS
            );

            if (this.scrollBackTimes.length >= SCROLL_BACK_COUNT) {
                this.onStruggle({
                    type: 're-reading',
                    word: this.currentWord?.word || '',
                    element: this.currentWord?.textNode.parentElement || null,
                    timestamp: now,
                    rect: this.currentWord?.rect,
                    sentence: this.currentWord?.sentence,
                    context: this.currentWord?.context,
                });
                this.scrollBackTimes = [];
            }
        }
        this.lastScrollY = currentY;
        this.resetIdle();
    };

    private resetIdle = (): void => {
        if (this.idleTimer) clearTimeout(this.idleTimer);
        this.startIdleTimer();
    };

    private startIdleTimer(): void {
        this.idleTimer = setTimeout(() => {
            this.onStruggle({
                type: 'paused',
                word: this.currentWord?.word || '',
                element: this.currentWord?.textNode.parentElement || null,
                timestamp: Date.now(),
                rect: this.currentWord?.rect,
                sentence: this.currentWord?.sentence,
                context: this.currentWord?.context,
            });
        }, IDLE_THRESHOLD_MS);
    }

    private clearAllTimers(): void {
        if (this.hoverTimer) clearTimeout(this.hoverTimer);
        this.hoverTimer = null;
        if (this.idleTimer) clearTimeout(this.idleTimer);
        this.scrollBackTimes = [];
        this.currentWord = null;
    }
}
