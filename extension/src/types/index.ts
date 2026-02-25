export interface WordData {
    index: number;
    word: string;
    element: HTMLElement | null;
}

// Re-export StruggleEvent from StruggleDetector to avoid duplication
export type { StruggleEvent } from '../content/StruggleDetector';
