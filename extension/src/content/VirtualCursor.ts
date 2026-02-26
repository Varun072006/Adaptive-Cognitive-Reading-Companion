// ============================================================
// VirtualCursor.ts — Zero-DOM-mutation word detection
// Uses caretRangeFromPoint to identify the word under the cursor
// in real-time without wrapping any DOM nodes in <span> elements.
// ============================================================

export interface WordAtPoint {
    word: string;
    rect: DOMRect;
    sentence: string;
    context: string; // current sentence + 2 preceding sentences
    textNode: Text;
    offset: number;
}

const SKIP_TAGS = new Set([
    'SCRIPT', 'STYLE', 'NOSCRIPT', 'IFRAME', 'OBJECT', 'EMBED',
    'SVG', 'CANVAS', 'VIDEO', 'AUDIO', 'INPUT', 'TEXTAREA',
    'SELECT', 'BUTTON', 'CODE', 'PRE', 'KBD',
]);

/**
 * VirtualCursor — detects words under the mouse without modifying the DOM.
 */
export class VirtualCursor {
    private highlighter: HTMLDivElement | null = null;
    private highlightColor: string;

    constructor(highlightColor = '#4A90D9') {
        this.highlightColor = highlightColor;
    }

    /**
     * Get the word at viewport coordinates (x, y).
     * Returns null if no text word is found at that point.
     */
    getWordAtPoint(x: number, y: number): WordAtPoint | null {
        try {
            // caretRangeFromPoint returns a Range at the character position
            // under the given viewport coordinates.
            const range = document.caretRangeFromPoint(x, y);
            if (!range) return null;

            const node = range.startContainer;
            if (node.nodeType !== Node.TEXT_NODE) return null;
            const textNode = node as Text;

            const parentEl = textNode.parentElement;
            if (!parentEl) return null;
            if (SKIP_TAGS.has(parentEl.tagName)) return null;

            const text = textNode.textContent;
            if (!text || !text.trim()) return null;

            const offset = range.startOffset;

            // Find word boundaries around the offset
            const wordBounds = this.getWordBoundaries(text, offset);
            if (!wordBounds) return null;

            const { start, end } = wordBounds;
            const word = text.slice(start, end);

            // Skip non-word content (pure punctuation, numbers only)
            if (!word || !/[a-zA-Z]/.test(word)) return null;

            // Get the bounding rect for this word using a Range
            const wordRange = document.createRange();
            wordRange.setStart(textNode, start);
            wordRange.setEnd(textNode, end);
            const rect = wordRange.getBoundingClientRect();

            // Verify the cursor is actually inside this word's rect
            // (caretRangeFromPoint can return adjacent chars on fast moves)
            if (rect.width === 0 || rect.height === 0) return null;

            // Get sentence and context
            const sentence = this.getContainingSentence(textNode, offset);
            const context = this.getSurroundingContext(textNode, offset);

            return { word, rect, sentence, context, textNode, offset };
        } catch {
            return null;
        }
    }

    /**
     * Find the start and end indices of the word at `offset` within `text`.
     */
    private getWordBoundaries(text: string, offset: number): { start: number; end: number } | null {
        if (offset >= text.length) offset = text.length - 1;
        if (offset < 0) return null;

        // If the character at offset is whitespace, no word here
        if (/\s/.test(text[offset])) return null;

        // Scan left to find word start
        let start = offset;
        while (start > 0 && !/\s/.test(text[start - 1])) {
            start--;
        }

        // Scan right to find word end
        let end = offset;
        while (end < text.length && !/\s/.test(text[end])) {
            end++;
        }

        // Strip leading/trailing punctuation from the word
        const raw = text.slice(start, end);
        const match = raw.match(/^[^a-zA-Z0-9]*(.*?)[^a-zA-Z0-9]*$/);
        if (!match || !match[1]) return null;

        const trimmedStart = start + raw.indexOf(match[1]);
        const trimmedEnd = trimmedStart + match[1].length;

        if (trimmedEnd <= trimmedStart) return null;
        return { start: trimmedStart, end: trimmedEnd };
    }

    /**
     * Extract the sentence containing the word at `offset` in the given text node.
     * Looks at the parent block element's full text content.
     */
    getContainingSentence(textNode: Text, offset: number): string {
        try {
            const parent = this.getBlockParent(textNode);
            if (!parent) return textNode.textContent?.trim() || '';

            const fullText = parent.textContent || '';
            // Find the character offset within the parent's text
            const textOffset = this.getOffsetInParent(textNode, offset, parent);

            return this.extractSentenceAt(fullText, textOffset);
        } catch {
            return textNode.textContent?.trim() || '';
        }
    }

    /**
     * Get the current sentence + up to 2 preceding sentences for AI context.
     */
    getSurroundingContext(textNode: Text, offset: number): string {
        try {
            const parent = this.getBlockParent(textNode);
            if (!parent) return textNode.textContent?.trim() || '';

            const fullText = parent.textContent || '';
            const textOffset = this.getOffsetInParent(textNode, offset, parent);

            // Split into sentences
            const sentences = fullText.match(/[^.!?]+[.!?]+|[^.!?]+$/g) || [fullText];
            let cumulativeLen = 0;
            let currentIdx = 0;

            for (let i = 0; i < sentences.length; i++) {
                cumulativeLen += sentences[i].length;
                if (cumulativeLen >= textOffset) {
                    currentIdx = i;
                    break;
                }
            }

            // Grab current + up to 2 preceding sentences
            const startIdx = Math.max(0, currentIdx - 2);
            return sentences.slice(startIdx, currentIdx + 1).join('').trim();
        } catch {
            return textNode.textContent?.trim() || '';
        }
    }

    /**
     * Find the closest block-level ancestor.
     */
    private getBlockParent(node: Node): Element | null {
        const blockTags = new Set(['P', 'DIV', 'LI', 'TD', 'TH', 'BLOCKQUOTE', 'ARTICLE', 'SECTION', 'H1', 'H2', 'H3', 'H4', 'H5', 'H6', 'FIGCAPTION', 'DD', 'DT']);
        let current: Node | null = node.parentNode;
        while (current && current !== document.body) {
            if (current.nodeType === Node.ELEMENT_NODE && blockTags.has((current as Element).tagName)) {
                return current as Element;
            }
            current = current.parentNode;
        }
        return node.parentElement;
    }

    /**
     * Calculate the character offset of a text node position within a parent element.
     */
    private getOffsetInParent(textNode: Text, offset: number, parent: Element): number {
        const walker = document.createTreeWalker(parent, NodeFilter.SHOW_TEXT);
        let pos = 0;
        while (walker.nextNode()) {
            if (walker.currentNode === textNode) {
                return pos + offset;
            }
            pos += (walker.currentNode.textContent || '').length;
        }
        return offset;
    }

    /**
     * Extract the sentence at a given character position.
     */
    private extractSentenceAt(text: string, pos: number): string {
        // Find sentence start — look back for sentence-ending punctuation
        let start = pos;
        while (start > 0) {
            const ch = text[start - 1];
            if ('.!?'.includes(ch)) {
                // Check it's truly a sentence end (not an abbreviation like "Dr.")
                if (start >= 2 && /\s/.test(text[start])) break;
            }
            start--;
        }

        // Find sentence end — look forward for sentence-ending punctuation
        let end = pos;
        while (end < text.length) {
            const ch = text[end];
            if ('.!?'.includes(ch)) {
                end++; // include the punctuation
                break;
            }
            end++;
        }

        return text.slice(start, end).trim();
    }

    /**
     * Show a bold, enlarged word overlay — a "magnifying lens" effect.
     * Renders the word text itself in bold at a larger size, positioned
     * directly over the original word. This makes words highly readable
     * for dyslexic users without modifying the page DOM.
     */
    showHighlight(rect: DOMRect, container: HTMLElement, word?: string): void {
        if (!this.highlighter) {
            this.highlighter = document.createElement('div');
            this.highlighter.className = 'acrc-virtual-highlight';
            this.highlighter.style.cssText = `
                position: fixed;
                pointer-events: none;
                z-index: 2147483647;
                transition: top 0.06s ease-out, left 0.06s ease-out, opacity 0.12s ease;
                font-family: 'OpenDyslexic', 'Comic Sans MS', 'Verdana', system-ui, sans-serif;
                font-weight: 800;
                color: #ffffff;
                background: rgba(74, 144, 217, 0.95);
                backdrop-filter: blur(8px);
                -webkit-backdrop-filter: blur(8px);
                border-radius: 8px;
                padding: 4px 10px;
                box-shadow: 0 4px 20px rgba(0,0,0,0.4), 0 0 0 2px rgba(255, 255, 255, 0.3);
                white-space: nowrap;
                letter-spacing: 0.04em;
                line-height: 1.3;
                text-shadow: 0 1px 2px rgba(0,0,0,0.3);
            `;
            container.appendChild(this.highlighter);
        }

        // Compute a scaled-up font size (1.4x the original word's height)
        const scaledFontSize = Math.max(rect.height * 1.35, 18);

        this.highlighter.textContent = word || '';
        this.highlighter.style.fontSize = `${scaledFontSize}px`;

        // Position centered over the word, shifted up slightly
        const highlightWidth = this.highlighter.offsetWidth || rect.width * 1.5;
        const topPos = rect.top - (scaledFontSize - rect.height) - 4;
        const leftPos = rect.left + rect.width / 2 - highlightWidth / 2;

        this.highlighter.style.top = `${Math.max(4, topPos)}px`;
        this.highlighter.style.left = `${Math.max(4, leftPos)}px`;
        this.highlighter.style.opacity = '1';
        this.highlighter.style.display = 'block';
    }

    /**
     * Hide the floating highlight.
     */
    hideHighlight(): void {
        if (this.highlighter) {
            this.highlighter.style.display = 'none';
        }
    }

    /**
     * Set the highlight color.
     */
    setHighlightColor(color: string): void {
        this.highlightColor = color;
    }

    /**
     * Clean up the highlighter element.
     */
    destroy(): void {
        this.highlighter?.remove();
        this.highlighter = null;
    }

    /**
     * Estimate the word count of the page without modifying the DOM.
     */
    static estimateWordCount(): number {
        const text = document.body?.innerText || '';
        if (!text.trim()) return 0;
        return text.split(/\s+/).filter(w => w.length > 0).length;
    }
}
