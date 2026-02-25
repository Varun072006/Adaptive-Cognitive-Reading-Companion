// ============================================================
// TTSEngine.ts — Web Speech API wrapper for text-to-speech
// ============================================================

export interface TTSOptions {
    rate: number;
    pitch: number;
    voiceURI: string | null;
}

const DEFAULT_OPTIONS: TTSOptions = {
    rate: 0.9,
    pitch: 1.0,
    voiceURI: null,
};

export class TTSEngine {
    private synth: SpeechSynthesis;
    private options: TTSOptions;
    private currentUtterance: SpeechSynthesisUtterance | null = null;
    private onWordBoundary: ((charIndex: number) => void) | null = null;
    private onEnd: (() => void) | null = null;

    constructor(options?: Partial<TTSOptions>) {
        this.synth = window.speechSynthesis;
        this.options = { ...DEFAULT_OPTIONS, ...options };
    }

    /**
     * Get available voices
     */
    getVoices(): SpeechSynthesisVoice[] {
        return this.synth.getVoices();
    }

    /**
     * Set the TTS options
     */
    setOptions(options: Partial<TTSOptions>): void {
        this.options = { ...this.options, ...options };
    }

    /**
     * Set word boundary callback for highlight sync
     */
    setOnWordBoundary(cb: (charIndex: number) => void): void {
        this.onWordBoundary = cb;
    }

    /**
     * Set end callback
     */
    setOnEnd(cb: () => void): void {
        this.onEnd = cb;
    }

    /**
     * Speak a single word
     */
    speakWord(word: string): void {
        this.stop();
        const utterance = new SpeechSynthesisUtterance(word);
        this.applyOptions(utterance);
        utterance.rate = Math.max(this.options.rate, 0.7); // Slower for single words
        this.synth.speak(utterance);
    }

    /**
     * Speak a full text passage with word boundary events
     */
    speakText(text: string): void {
        this.stop();
        const utterance = new SpeechSynthesisUtterance(text);
        this.applyOptions(utterance);

        utterance.onboundary = (event) => {
            if (event.name === 'word' && this.onWordBoundary) {
                this.onWordBoundary(event.charIndex);
            }
        };

        utterance.onend = () => {
            this.currentUtterance = null;
            this.onEnd?.();
        };

        this.currentUtterance = utterance;
        this.synth.speak(utterance);
    }

    /**
     * Pause speech
     */
    pause(): void {
        this.synth.pause();
    }

    /**
     * Resume speech
     */
    resume(): void {
        this.synth.resume();
    }

    /**
     * Stop and cancel all speech
     */
    stop(): void {
        this.synth.cancel();
        this.currentUtterance = null;
    }

    /**
     * Check if currently speaking
     */
    get isSpeaking(): boolean {
        return this.synth.speaking;
    }

    /**
     * Check if paused
     */
    get isPaused(): boolean {
        return this.synth.paused;
    }

    private applyOptions(utterance: SpeechSynthesisUtterance): void {
        utterance.rate = this.options.rate;
        utterance.pitch = this.options.pitch;

        if (this.options.voiceURI) {
            const voice = this.getVoices().find((v) => v.voiceURI === this.options.voiceURI);
            if (voice) utterance.voice = voice;
        }
    }
}
