(async () => {
    const src = chrome.runtime.getURL('content.js');
    console.log('[ACRC] Loading content module from:', src);
    try {
        await import(src);
        console.log('[ACRC] Content module loaded successfully');
    } catch (err) {
        console.error('[ACRC] Failed to load content module:', err);
    }
})();
