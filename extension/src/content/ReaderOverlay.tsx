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

    // Hover highlight on `acrc-word` spans
    useEffect(() => {
        if (!highlightOnHover) return;

        const handleOver = (e: MouseEvent) => {
            const target = e.target as HTMLElement;
            if (target.classList?.contains('acrc-word')) {
                target.style.background = `${highlightColor}22`;
                target.style.boxShadow = `0 0 0 2px ${highlightColor}44`;
                target.style.borderRadius = '3px';
            }
        };
        const handleOut = (e: MouseEvent) => {
            const target = e.target as HTMLElement;
            if (target.classList?.contains('acrc-word')) {
                target.style.background = '';
                target.style.boxShadow = '';
            }
        };

        document.addEventListener('mouseover', handleOver);
        document.addEventListener('mouseout', handleOut);
        return () => {
            document.removeEventListener('mouseover', handleOver);
            document.removeEventListener('mouseout', handleOut);
        };
    }, [highlightOnHover, highlightColor]);

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
