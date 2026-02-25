// ============================================================
// StruggleDetector.ts — detects reading difficulty patterns
// ============================================================

export type StruggleType = 'stuck' | 're-reading' | 'paused' | 'selection';

export interface StruggleEvent {
    type: StruggleType;
    word: string;
    element: HTMLElement | null;
    timestamp: number;
    rect?: DOMRect;
}

type StruggleCallback = (event: StruggleEvent) => void;

const HOVER_THRESHOLD_MS = 2000;      // Stuck on a word
const SCROLL_BACK_WINDOW_MS = 5000;   // Re-reading detection window
const SCROLL_BACK_COUNT = 3;          // Scroll-ups needed to trigger
const IDLE_THRESHOLD_MS = 8000;       // Paused too long

export class StruggleDetector {
    private onStruggle: StruggleCallback;
    private hoverTimers: Map<string, ReturnType<typeof setTimeout>> = new Map();
    private scrollBackTimes: number[] = [];
    private lastScrollY: number = 0;
    private idleTimer: ReturnType<typeof setTimeout> | null = null;
    private currentHoveredWord: string = '';
    private currentHoveredEl: HTMLElement | null = null;
    private dismissedWords: Set<string> = new Set();
    private active: boolean = false;

    constructor(callback: StruggleCallback) {
        this.onStruggle = callback;
    }

    start(): void {
        if (this.active) return;
        this.active = true;
        document.addEventListener('mouseover', this.handleMouseOver);
        document.addEventListener('mouseout', this.handleMouseOut);
        document.addEventListener('scroll', this.handleScroll);
        document.addEventListener('mousemove', this.resetIdle);
        document.addEventListener('keydown', this.resetIdle);
        this.startIdleTimer();
    }

    stop(): void {
        this.active = false;
        document.removeEventListener('mouseover', this.handleMouseOver);
        document.removeEventListener('mouseout', this.handleMouseOut);
        document.removeEventListener('scroll', this.handleScroll);
        document.removeEventListener('mousemove', this.resetIdle);
        document.removeEventListener('keydown', this.resetIdle);
        this.clearAllTimers();
    }

    dismissWord(word: string): void {
        this.dismissedWords.add(word.toLowerCase());
    }

    private handleMouseOver = (e: MouseEvent): void => {
        const target = e.target as HTMLElement;
        if (!target.classList?.contains('acrc-word')) return;

        const word = target.dataset.word || target.textContent || '';
        const idx = target.dataset.idx || '';
        this.currentHoveredWord = word;
        this.currentHoveredEl = target;

        if (this.dismissedWords.has(word.toLowerCase())) return;

        // Start hover timer
        const timer = setTimeout(() => {
            this.onStruggle({
                type: 'stuck',
                word,
                element: target,
                timestamp: Date.now(),
            });
        }, HOVER_THRESHOLD_MS);

        this.hoverTimers.set(idx, timer);
        this.resetIdle();
    };

    private handleMouseOut = (e: MouseEvent): void => {
        const target = e.target as HTMLElement;
        if (!target.classList?.contains('acrc-word')) return;

        const idx = target.dataset.idx || '';
        const timer = this.hoverTimers.get(idx);
        if (timer) {
            clearTimeout(timer);
            this.hoverTimers.delete(idx);
        }

        this.currentHoveredWord = '';
        this.currentHoveredEl = null;
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
                    word: this.currentHoveredWord,
                    element: this.currentHoveredEl,
                    timestamp: now,
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
                word: this.currentHoveredWord,
                element: this.currentHoveredEl,
                timestamp: Date.now(),
            });
        }, IDLE_THRESHOLD_MS);
    }

    private clearAllTimers(): void {
        this.hoverTimers.forEach((timer) => clearTimeout(timer));
        this.hoverTimers.clear();
        if (this.idleTimer) clearTimeout(this.idleTimer);
        this.scrollBackTimes = [];
    }
}
