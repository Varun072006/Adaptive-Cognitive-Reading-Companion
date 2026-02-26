// ============================================================
// ReaderOverlay.tsx — reading ruler & line focus + highlight
// ============================================================

import React, { useState, useEffect, useCallback } from 'react';

interface Props {
    rulerEnabled: boolean;
    lineFocusEnabled: boolean;
    highlightOnHover: boolean;
    highlightColor?: string;
}

const RULER_HEIGHT = 40;
const FOCUS_LINE_HEIGHT = 60;

const ReaderOverlay: React.FC<Props> = ({
    rulerEnabled,
    lineFocusEnabled,
    highlightOnHover,
    highlightColor = '#4A90D9',
}) => {
    const [mouseY, setMouseY] = useState(0);

    const handleMouseMove = useCallback(
        (e: MouseEvent) => {
            if (rulerEnabled || lineFocusEnabled) {
                setMouseY(e.clientY);
            }
        },
        [rulerEnabled, lineFocusEnabled]
    );

    // Word hover highlight is now handled by VirtualCursor
    // This component only manages the ruler and line focus overlays

    useEffect(() => {
        window.addEventListener('mousemove', handleMouseMove);
        return () => window.removeEventListener('mousemove', handleMouseMove);
    }, [handleMouseMove]);

    if (!rulerEnabled && !lineFocusEnabled) return null;

    return (
        <>
            {/* Reading ruler line */}
            {rulerEnabled && (
                <div
                    className="acrc-ruler"
                    style={{
                        position: 'fixed',
                        top: mouseY + RULER_HEIGHT / 2,
                        left: 0,
                        width: '100%',
                        height: '2px',
                        background: `linear-gradient(90deg, transparent, ${highlightColor}88, transparent)`,
                        pointerEvents: 'none',
                        zIndex: 2147483645,
                        transition: 'top 0.08s linear',
                    }}
                />
            )}

            {/* Line focus (dim above & below) */}
            {lineFocusEnabled && (
                <>
                    <div
                        className="acrc-focus-top"
                        style={{
                            position: 'fixed',
                            top: 0,
                            left: 0,
                            width: '100%',
                            height: Math.max(0, mouseY - FOCUS_LINE_HEIGHT / 2),
                            background: 'rgba(0, 0, 0, 0.55)',
                            pointerEvents: 'none',
                            zIndex: 2147483644,
                            transition: 'height 0.08s linear',
                        }}
                    />
                    <div
                        className="acrc-focus-bottom"
                        style={{
                            position: 'fixed',
                            top: mouseY + FOCUS_LINE_HEIGHT / 2,
                            left: 0,
                            width: '100%',
                            height: `calc(100vh - ${mouseY + FOCUS_LINE_HEIGHT / 2}px)`,
                            background: 'rgba(0, 0, 0, 0.55)',
                            pointerEvents: 'none',
                            zIndex: 2147483644,
                            transition: 'top 0.08s linear',
                        }}
                    />
                </>
            )}
        </>
    );
};

export default ReaderOverlay;
