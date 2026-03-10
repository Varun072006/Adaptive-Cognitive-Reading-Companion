import React, { useEffect, useRef, useState } from 'react';

interface MermaidRendererProps {
    chart: string;
    zoom?: number;
    onSpeak?: (text: string) => void;
}

const MermaidRenderer: React.FC<MermaidRendererProps> = ({ chart, zoom = 1.0, onSpeak }) => {
    const iframeRef = useRef<HTMLIFrameElement>(null);
    const [isReady, setIsReady] = useState(false);
    const [height, setHeight] = useState(400);
    const [error, setError] = useState<string | null>(null);
    const [loading, setLoading] = useState(true);
    const renderId = useRef(Math.random().toString(36).substr(2, 9));
    const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

    const sendRenderRequest = () => {
        if (chart && iframeRef.current?.contentWindow) {
            console.log('Sending render request to iframe for chart:', chart);
            setLoading(true);
            setError(null);

            iframeRef.current.contentWindow.postMessage({
                type: 'render',
                chart,
                id: renderId.current
            }, '*');

            // Set a timeout for rendering
            if (timeoutRef.current) clearTimeout(timeoutRef.current);
            timeoutRef.current = setTimeout(() => {
                if (loading) {
                    setError('Rendering is taking longer than expected... maybe it is too complex?');
                    setLoading(false);
                }
            }, 8000);
        }
    };

    useEffect(() => {
        if (isReady && iframeRef.current?.contentWindow) {
            iframeRef.current.contentWindow.postMessage({
                type: 'zoom',
                zoom,
                reset: zoom === 1.0
            }, '*');
        }
    }, [zoom, isReady]);

    useEffect(() => {
        const handleMessage = (event: MessageEvent) => {
            const { type, id, height: newHeight, message, text } = event.data;

            if (type === 'ready') {
                console.log('Mermaid iframe ready signal received');
                setIsReady(true);
            } else if (type === 'rendered' && id === renderId.current) {
                console.log('Mermaid rendered with height:', newHeight);
                setHeight(Math.max(newHeight, 350));
                setError(null);
                setLoading(false);
                if (timeoutRef.current) clearTimeout(timeoutRef.current);
            } else if (type === 'error' && id === renderId.current) {
                console.error('Mermaid render error from iframe:', message);
                setError(message || 'Failed to render diagram');
                setLoading(false);
                if (timeoutRef.current) clearTimeout(timeoutRef.current);
            } else if (type === 'speak' && onSpeak && text) {
                onSpeak(text);
            }
        };

        window.addEventListener('message', handleMessage);
        return () => {
            window.removeEventListener('message', handleMessage);
            if (timeoutRef.current) clearTimeout(timeoutRef.current);
        };
    }, []);

    useEffect(() => {
        if (isReady && chart) {
            sendRenderRequest();
        }
    }, [chart, isReady]);

    // Construct the URL using chrome.runtime.getURL
    const iframeSrc = typeof chrome !== 'undefined' && chrome.runtime?.getURL
        ? chrome.runtime.getURL('mermaid-viewer.html')
        : '';

    if (!iframeSrc) {
        return <div style={{ color: '#aaa', fontSize: '12px', padding: '20px', textAlign: 'center' }}>Initializing diagram...</div>;
    }

    return (
        <div style={{ width: '100%', position: 'relative', minHeight: '300px', display: 'flex', flexDirection: 'column' }}>
            {loading && !error && (
                <div style={{
                    position: 'absolute',
                    top: '100px',
                    left: '50%',
                    transform: 'translate(-50%, -50%)',
                    color: '#52B788',
                    fontSize: '14px',
                    zIndex: 2,
                    background: 'rgba(0,0,0,0.4)',
                    padding: '10px 20px',
                    borderRadius: '20px',
                    backdropFilter: 'blur(4px)'
                }}>
                    🎨 Drawing Mind Map...
                </div>
            )}
            {error && (
                <div style={{ padding: '20px', textAlign: 'center', background: 'rgba(255,107,107,0.1)', borderRadius: '16px', border: '1px solid rgba(255,107,107,0.3)' }}>
                    <div style={{ color: '#ff6b6b', fontSize: '14px', marginBottom: '12px' }}>{error}</div>
                    <button
                        onClick={sendRenderRequest}
                        style={{ background: '#ff6b6b', color: 'white', border: 'none', padding: '8px 16px', borderRadius: '8px', cursor: 'pointer', fontWeight: 600 }}
                    >
                        Retry Rendering
                    </button>
                </div>
            )}
            <iframe
                ref={iframeRef}
                src={iframeSrc}
                style={{
                    width: '100%',
                    height: `${height}px`,
                    border: 'none',
                    background: 'transparent',
                    position: ((loading && !error) || error) ? 'absolute' : 'relative',
                    visibility: ((loading && !error) || error) ? 'hidden' : 'visible',
                    opacity: ((loading && !error) || error) ? 0 : 1,
                    pointerEvents: ((loading && !error) || error) ? 'none' : 'auto',
                    transition: 'opacity 0.3s ease, height 0.3s ease'
                }}
                title="Mermaid Diagram"
            />
        </div>
    );
};

export default MermaidRenderer;
