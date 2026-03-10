// Set a slight background for debug visibility
document.body.style.background = 'rgba(255, 255, 255, 0.02)';

// Initialize mermaid
try {
    // Catch-all for resource errors (like mermaid.min.js failing to load)
    window.onerror = function (msg, url, lineNo, columnNo, error) {
        console.error('Window error:', msg, 'at', url, ':', lineNo);
        window.parent.postMessage({ type: 'error', message: 'Script error: ' + msg }, '*');
        return false;
    };

    window.onunhandledrejection = function (event) {
        console.error('Unhandled rejection:', event.reason);
        window.parent.postMessage({ type: 'error', message: 'Promise rejection: ' + event.reason }, '*');
    };

    mermaid.initialize({
        startOnLoad: false,
        theme: 'base',
        securityLevel: 'loose',
        fontFamily: 'OpenDyslexic, Comic Sans MS, cursive',
        logLevel: 'debug',
        mindmap: {
            useMaxWidth: false
        },
        themeVariables: {
            fontSize: '18px',
            fontFamily: 'OpenDyslexic',
            primaryColor: '#FDF6E3',
            lineColor: '#333333',
            nodeTextColor: '#333333',
            mainBkg: '#FFFFE0',
            nodeBorder: '#333333'
        }
    });
    console.log('Mermaid initialized successfully');
} catch (e) {
    console.error('Mermaid initialization failed:', e);
    window.parent.postMessage({ type: 'error', message: 'Initialization failed: ' + e.message }, '*');
}

// State for pan and zoom
let zoomLevel = 1.0;
let isPanning = false;
let startX, startY;
let currentX = 0, currentY = 0;

const container = document.getElementById('graph');

// Pan handler
container.addEventListener('mousedown', (e) => {
    isPanning = true;
    startX = e.clientX - currentX;
    startY = e.clientY - currentY;
    container.style.cursor = 'grabbing';
});

window.addEventListener('mousemove', (e) => {
    if (!isPanning) return;
    currentX = e.clientX - startX;
    currentY = e.clientY - startY;
    updateTransform();
});

window.addEventListener('mouseup', () => {
    isPanning = false;
    container.style.cursor = 'grab';
});

function updateTransform() {
    const svgElement = container.querySelector('svg');
    if (svgElement) {
        svgElement.style.transform = `translate(${currentX}px, ${currentY}px) scale(${zoomLevel})`;
        svgElement.style.transformOrigin = 'center';
    }
}

// Listen for messages from the parent window
window.addEventListener('message', async (event) => {
    console.log('Mermaid viewer received message:', event.data.type);
    const { type, chart, id, zoom, reset } = event.data;

    if (type === 'render') {
        if (!chart) {
            console.error('No chart data provided');
            return;
        }

        try {
            container.innerHTML = 'Rendering...';
            console.log('Rendering chart ID:', id);

            // Clean up previous SVG if any
            const existingSvg = document.getElementById('mermaid-' + id);
            if (existingSvg) existingSvg.remove();

            console.log('Starting mermaid.render for:', id);
            const { svg } = await mermaid.render('mermaid-' + id, chart);
            container.innerHTML = svg;

            // Initial styling
            const svgElement = container.querySelector('svg');
            if (svgElement) {
                svgElement.style.width = '100%';
                svgElement.style.height = 'auto';
                svgElement.style.display = 'block';
                svgElement.style.transition = 'transform 0.2s ease-out';
                container.style.cursor = 'grab';
                updateTransform();

                // Add interactive click handlers to nodes
                const nodes = svgElement.querySelectorAll('.mindmap-node');
                nodes.forEach(node => {
                    node.addEventListener('click', (e) => {
                        e.stopPropagation();
                        // Find the text content inside this node
                        let text = '';
                        const textElement = node.querySelector('text');
                        if (textElement) {
                            text = textElement.textContent || '';
                        } else {
                            // Extract from inner nodes if any
                            const tspans = node.querySelectorAll('tspan');
                            if (tspans.length > 0) {
                                text = Array.from(tspans).map(t => t.textContent).join(' ');
                            }
                        }

                        if (text && text.trim()) {
                            window.parent.postMessage({ type: 'speak', text: text.trim() }, '*');
                        }
                    });
                });
            }

            // Request height update after rendering
            setTimeout(() => {
                let height = document.body.scrollHeight;
                const svgEl = container.querySelector('svg');
                if (svgEl) {
                    const rect = svgEl.getBoundingClientRect();
                    // Add some padding to the SVG height
                    height = Math.max(height, rect.height + 40);
                }
                console.log('Final rendered height:', height);
                window.parent.postMessage({ type: 'rendered', id, height }, '*');
            }, 150);
        } catch (err) {
            console.error('Mermaid rendering error:', err);
            container.innerHTML = '<div style="color:#ff6b6b; padding: 10px; font-size: 14px; background: rgba(0,0,0,0.5); border-radius: 8px;">' +
                '<strong>Render Error:</strong><br>' + err.message + '</div>';
            window.parent.postMessage({ type: 'error', id, message: err.message }, '*');
        }
    } else if (type === 'zoom') {
        zoomLevel = zoom || 1.0;
        if (reset) {
            currentX = 0;
            currentY = 0;
        }
        updateTransform();
    }
});

// CRITICAL: Send signal that we are ready to receive render requests
window.onload = () => {
    console.log('Mermaid viewer loaded and sending ready signal');
    window.parent.postMessage({ type: 'ready' }, '*');
};

// Signal to parent that we are ready
console.log('Mermaid viewer sending ready signal');
window.parent.postMessage({ type: 'ready' }, '*');
