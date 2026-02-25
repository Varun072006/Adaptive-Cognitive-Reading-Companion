// ============================================================
// GazeTracker.ts — WebGazer.js integration for eye tracking
//
// Uses webcam to track where the user is looking on the page.
// Detects fixation (staring at a point) and confusion signals.
// Completely optional and consent-based.
// ============================================================

type GazeCallback = (x: number, y: number, element: HTMLElement | null) => void;
type ConfusionCallback = (element: HTMLElement | null, word: string) => void;

interface GazeTrackerOptions {
    /** Milliseconds of eye fixation before triggering confusion */
    fixationThresholdMs: number;
    /** Whether to show the gaze dot on screen */
    showGazeDot: boolean;
    /** Whether to show the webcam preview */
    showWebcam: boolean;
    /** Callback when confusion is detected */
    onConfusion: ConfusionCallback;
    /** Callback on each gaze update */
    onGaze?: GazeCallback;
}

const DEFAULT_OPTIONS: GazeTrackerOptions = {
    fixationThresholdMs: 3000,
    showGazeDot: true,
    showWebcam: true,
    onConfusion: () => { },
};

export class GazeTracker {
    private options: GazeTrackerOptions;
    private active = false;
    private gazeDot: HTMLDivElement | null = null;
    private lastGazeElement: HTMLElement | null = null;
    private lastGazeWord = '';
    private fixationStart = 0;
    private fixationTimer: ReturnType<typeof setInterval> | null = null;
    private webgazerLoaded = false;

    constructor(options: Partial<GazeTrackerOptions> & { onConfusion: ConfusionCallback }) {
        this.options = { ...DEFAULT_OPTIONS, ...options };
    }

    /**
     * Load WebGazer.js dynamically from CDN
     */
    private async loadWebGazer(): Promise<void> {
        if (this.webgazerLoaded || (window as any).webgazer) {
            this.webgazerLoaded = true;
            return;
        }

        return new Promise((resolve, reject) => {
            const script = document.createElement('script');
            script.src = 'https://webgazer.cs.brown.edu/webgazer.js';
            script.onload = () => {
                this.webgazerLoaded = true;
                resolve();
            };
            script.onerror = () => reject(new Error('Failed to load WebGazer.js'));
            document.head.appendChild(script);
        });
    }

    /**
     * Start gaze tracking (requests webcam permission)
     */
    async start(): Promise<boolean> {
        if (this.active) return true;

        try {
            await this.loadWebGazer();

            const webgazer = (window as any).webgazer;
            if (!webgazer) {
                console.error('[ACRC] WebGazer not available');
                return false;
            }

            // Create gaze visualization dot
            if (this.options.showGazeDot) {
                this.gazeDot = document.createElement('div');
                this.gazeDot.className = 'acrc-gaze-dot';
                this.gazeDot.id = 'acrc-gaze-dot';
                document.body.appendChild(this.gazeDot);
            }

            // Configure WebGazer
            webgazer
                .setGazeListener((data: { x: number; y: number } | null) => {
                    if (!data) return;
                    this.handleGaze(data.x, data.y);
                })
                .saveDataAcrossSessions(false) // privacy: don't persist
                .begin();

            // Hide/show WebGazer's default video element
            const videoEl = document.getElementById('webgazerVideoFeed') as HTMLVideoElement;
            if (videoEl) {
                if (this.options.showWebcam) {
                    videoEl.classList.add('acrc-webcam-preview');
                    // Remove WebGazer's default styling
                    videoEl.style.cssText = '';
                } else {
                    videoEl.style.display = 'none';
                }
            }

            // Hide WebGazer's default overlay elements
            const overlays = ['webgazerFaceFeedbackBox', 'webgazerFaceOverlay', 'webgazerVideoCanvas'];
            overlays.forEach(id => {
                const el = document.getElementById(id);
                if (el) el.style.display = 'none';
            });

            // Start fixation detection loop
            this.fixationTimer = setInterval(() => this.checkFixation(), 500);

            this.active = true;
            console.log('[ACRC] Gaze tracking started');
            return true;
        } catch (err) {
            console.error('[ACRC] Gaze tracking error:', err);
            return false;
        }
    }

    /**
     * Stop gaze tracking
     */
    stop(): void {
        if (!this.active) return;

        try {
            const webgazer = (window as any).webgazer;
            if (webgazer) {
                webgazer.end();
            }
        } catch { /* ignore cleanup errors */ }

        if (this.gazeDot) {
            this.gazeDot.remove();
            this.gazeDot = null;
        }

        if (this.fixationTimer) {
            clearInterval(this.fixationTimer);
            this.fixationTimer = null;
        }

        // Clean up WebGazer elements
        ['webgazerVideoFeed', 'webgazerFaceFeedbackBox', 'webgazerFaceOverlay', 'webgazerVideoCanvas', 'webgazerGazeDot']
            .forEach(id => document.getElementById(id)?.remove());

        this.active = false;
        this.lastGazeElement = null;
        this.lastGazeWord = '';
        console.log('[ACRC] Gaze tracking stopped');
    }

    /**
     * Handle each gaze data point
     */
    private handleGaze(x: number, y: number): void {
        // Update gaze dot position
        if (this.gazeDot) {
            this.gazeDot.style.left = `${x}px`;
            this.gazeDot.style.top = `${y}px`;
        }

        // Find the element at the gaze point
        const el = document.elementFromPoint(x, y) as HTMLElement;

        // Check if it's a word span
        const wordEl = el?.closest?.('.acrc-word') as HTMLElement | null;
        const word = wordEl?.dataset?.word || wordEl?.textContent || '';

        // If gaze moved to a different word, reset fixation
        if (wordEl !== this.lastGazeElement || word !== this.lastGazeWord) {
            this.lastGazeElement = wordEl;
            this.lastGazeWord = word;
            this.fixationStart = Date.now();
        }

        // Invoke optional gaze callback
        this.options.onGaze?.(x, y, wordEl);
    }

    /**
     * Check if user has been fixating on a word too long
     */
    private checkFixation(): void {
        if (!this.lastGazeElement || !this.lastGazeWord) return;

        const duration = Date.now() - this.fixationStart;
        if (duration >= this.options.fixationThresholdMs) {
            // Trigger confusion callback
            this.options.onConfusion(this.lastGazeElement, this.lastGazeWord);
            // Reset to avoid repeated triggers
            this.fixationStart = Date.now() + this.options.fixationThresholdMs;
        }
    }

    /**
     * Whether gaze tracking is currently active
     */
    get isActive(): boolean {
        return this.active;
    }
}
