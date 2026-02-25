// ============================================================
// DomParser.ts — Cleans & segments page DOM into word spans
// ============================================================

const SKIP_TAGS = new Set([
    'SCRIPT', 'STYLE', 'NOSCRIPT', 'IFRAME', 'OBJECT', 'EMBED',
    'SVG', 'CANVAS', 'VIDEO', 'AUDIO', 'INPUT', 'TEXTAREA',
    'SELECT', 'BUTTON', 'CODE', 'PRE', 'KBD',
]);

const ACRC_WORD_CLASS = 'acrc-word';
const ACRC_PROCESSED_ATTR = 'data-acrc-processed';

let wordIndex = 0;

/**
 * Check if an element should be skipped during DOM parsing
 */
function shouldSkipElement(el: Element): boolean {
    try {
        if (SKIP_TAGS.has(el.tagName)) return true;
        if (el.getAttribute('aria-hidden') === 'true') return true;
        if (el.getAttribute('contenteditable') === 'true') return true;
        if (el.getAttribute('role') === 'textbox') return true;
        const style = window.getComputedStyle(el);
        if (style.display === 'none' || style.visibility === 'hidden') return true;
        return false;
    } catch {
        // getComputedStyle can throw for detached or special elements
        return true;
    }
}

/**
 * Wrap each word in a text node with a span
 */
function wrapTextNode(textNode: Text): void {
    try {
        const text = textNode.textContent;
        if (!text || !text.trim()) return;

        const parent = textNode.parentElement;
        if (!parent || parent.classList.contains(ACRC_WORD_CLASS)) return;
        if (parent.hasAttribute(ACRC_PROCESSED_ATTR)) return;
        // Skip elements inside shadow DOM or iframes
        if (!parent.isConnected) return;

        const fragment = document.createDocumentFragment();
        // Split by word boundaries, preserving whitespace
        const parts = text.split(/(\s+)/);

        for (const part of parts) {
            if (/^\s+$/.test(part)) {
                // Preserve whitespace as text node
                fragment.appendChild(document.createTextNode(part));
            } else if (part.length > 0) {
                const span = document.createElement('span');
                span.className = ACRC_WORD_CLASS;
                span.dataset.idx = String(wordIndex++);
                span.dataset.word = part.toLowerCase().replace(/[^\w]/g, '');
                span.textContent = part;
                fragment.appendChild(span);
            }
        }

        parent.setAttribute(ACRC_PROCESSED_ATTR, 'true');
        textNode.replaceWith(fragment);
    } catch {
        // replaceWith can throw for read-only or detached DOM nodes
    }
}

/**
 * Recursively walk the DOM tree, wrapping text nodes
 */
function walkDOM(node: Node): void {
    if (node.nodeType === Node.TEXT_NODE) {
        wrapTextNode(node as Text);
        return;
    }

    if (node.nodeType !== Node.ELEMENT_NODE) return;
    const el = node as Element;
    if (shouldSkipElement(el)) return;

    // Collect child nodes first (since wrapping modifies the DOM)
    const children = Array.from(node.childNodes);
    for (const child of children) {
        walkDOM(child);
    }
}

/**
 * Parse the page DOM and segment all visible text into acrc-word spans.
 * Returns the total number of words found.
 */
export function parseDom(): number {
    wordIndex = 0;
    const body = document.body;
    if (!body) return 0;
    walkDOM(body);
    return wordIndex;
}

/**
 * Remove all ACRC word spans and restore original text nodes.
 */
export function cleanDom(): void {
    const spans = document.querySelectorAll(`.${ACRC_WORD_CLASS}`);
    spans.forEach((span) => {
        const textNode = document.createTextNode(span.textContent || '');
        span.replaceWith(textNode);
    });

    const processed = document.querySelectorAll(`[${ACRC_PROCESSED_ATTR}]`);
    processed.forEach((el) => {
        el.removeAttribute(ACRC_PROCESSED_ATTR);
        el.normalize(); // Merge adjacent text nodes
    });
}

export { ACRC_WORD_CLASS };
