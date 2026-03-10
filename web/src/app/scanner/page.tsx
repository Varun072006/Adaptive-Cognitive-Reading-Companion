"use client";

import { useState, useRef, useCallback } from "react";

export default function ScannerPage() {
    const [image, setImage] = useState<string | null>(null);
    const [file, setFile] = useState<File | null>(null);
    const [originalText, setOriginalText] = useState("");
    const [simplifiedText, setSimplifiedText] = useState("");
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState("");
    const [cameraActive, setCameraActive] = useState(false);
    const videoRef = useRef<HTMLVideoElement>(null);
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const streamRef = useRef<MediaStream | null>(null);

    const startCamera = async () => {
        try {
            const stream = await navigator.mediaDevices.getUserMedia({
                video: { facingMode: "environment", width: 1280, height: 720 },
            });
            streamRef.current = stream;
            if (videoRef.current) {
                videoRef.current.srcObject = stream;
            }
            setCameraActive(true);
        } catch (err) {
            setError("Camera access denied. Please use file upload instead.");
        }
    };

    const stopCamera = () => {
        streamRef.current?.getTracks().forEach((t) => t.stop());
        streamRef.current = null;
        setCameraActive(false);
    };

    const captureFrame = () => {
        if (!videoRef.current || !canvasRef.current) return;
        const video = videoRef.current;
        const canvas = canvasRef.current;
        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;
        const ctx = canvas.getContext("2d");
        ctx?.drawImage(video, 0, 0);

        canvas.toBlob((blob) => {
            if (blob) {
                const f = new File([blob], "capture.png", { type: "image/png" });
                setFile(f);
                setImage(canvas.toDataURL());
                stopCamera();
            }
        }, "image/png");
    };

    const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
        const f = e.target.files?.[0];
        if (!f) return;
        setFile(f);
        const reader = new FileReader();
        reader.onload = () => setImage(reader.result as string);
        reader.readAsDataURL(f);
    };

    const processImage = async () => {
        if (!file) return;
        setLoading(true);
        setError("");
        setOriginalText("");
        setSimplifiedText("");

        try {
            const formData = new FormData();
            formData.append("image", file);
            formData.append("simplify", "true");

            const res = await fetch("/api/ocr", {
                method: "POST",
                body: formData,
            });

            if (!res.ok) throw new Error(`Server error: ${res.status}`);

            const data = await res.json();
            if (data.error) throw new Error(data.error);

            setOriginalText(data.original || "No text detected");
            setSimplifiedText(data.simplified || "");
        } catch (err: any) {
            setError(err.message || "Failed to process image");
        } finally {
            setLoading(false);
        }
    };

    const speakText = useCallback((text: string) => {
        const utterance = new SpeechSynthesisUtterance(text);
        utterance.rate = 0.9;
        window.speechSynthesis.cancel();
        window.speechSynthesis.speak(utterance);
    }, []);

    return (
        <div className="min-h-screen py-12 px-6">
            <div className="max-w-4xl mx-auto space-y-8">
                {/* Header */}
                <div className="text-center space-y-2">
                    <h1 className="text-4xl font-bold gradient-text">📷 OCR Scanner</h1>
                    <p className="text-gray-400">
                        Capture or upload an image of text — extract, read aloud, and
                        simplify
                    </p>
                </div>

                {/* Camera / Upload Section */}
                <div className="glass-card p-6 space-y-4">
                    {cameraActive ? (
                        <div className="space-y-4">
                            <video
                                ref={videoRef}
                                autoPlay
                                playsInline
                                className="w-full rounded-xl"
                            />
                            <div className="flex gap-3 justify-center">
                                <button
                                    onClick={captureFrame}
                                    className="px-6 py-3 rounded-xl bg-blue-500 hover:bg-blue-600 text-white font-semibold transition-all"
                                >
                                    📸 Capture
                                </button>
                                <button
                                    onClick={stopCamera}
                                    className="px-6 py-3 rounded-xl glass-card text-gray-300 hover:bg-white/10 transition-all"
                                >
                                    Cancel
                                </button>
                            </div>
                        </div>
                    ) : (
                        <div className="flex flex-col md:flex-row gap-4">
                            <button
                                onClick={startCamera}
                                className="flex-1 p-6 rounded-xl bg-gradient-to-r from-blue-500/20 to-purple-500/20 border border-blue-500/30 text-blue-300 hover:bg-blue-500/30 transition-all text-center"
                            >
                                <div className="text-3xl mb-2">📷</div>
                                <p className="font-semibold">Use Camera</p>
                                <p className="text-xs text-gray-400 mt-1">
                                    Point at text to capture
                                </p>
                            </button>

                            <label className="flex-1 p-6 rounded-xl bg-gradient-to-r from-green-500/20 to-teal-500/20 border border-green-500/30 text-green-300 hover:bg-green-500/30 transition-all text-center cursor-pointer">
                                <div className="text-3xl mb-2">📁</div>
                                <p className="font-semibold">Upload Image</p>
                                <p className="text-xs text-gray-400 mt-1">
                                    JPG, PNG, or PDF
                                </p>
                                <input
                                    type="file"
                                    accept="image/*,.pdf"
                                    onChange={handleFileUpload}
                                    className="hidden"
                                />
                            </label>
                        </div>
                    )}
                </div>

                {/* Preview */}
                {image && (
                    <div className="glass-card p-6 space-y-4">
                        <h2 className="text-lg font-semibold text-white">Preview</h2>
                        <img
                            src={image}
                            alt="Captured"
                            className="w-full max-h-80 object-contain rounded-xl"
                        />
                        <button
                            onClick={processImage}
                            disabled={loading}
                            className="w-full py-3 rounded-xl bg-gradient-to-r from-blue-500 to-purple-500 text-white font-semibold hover:from-blue-600 hover:to-purple-600 transition-all disabled:opacity-50"
                        >
                            {loading ? "⏳ Processing..." : "🔍 Extract & Simplify Text"}
                        </button>
                    </div>
                )}

                {/* Error */}
                {error && (
                    <div className="glass-card p-4 border-red-500/30 text-red-400 text-sm">
                        ⚠️ {error}
                    </div>
                )}

                {/* Results */}
                {originalText && (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        {/* Original */}
                        <div className="glass-card p-6 space-y-3">
                            <div className="flex items-center justify-between">
                                <h3 className="font-semibold text-white">Original Text</h3>
                                <button
                                    onClick={() => speakText(originalText)}
                                    className="text-sm px-3 py-1 rounded-lg bg-blue-500/20 text-blue-300 hover:bg-blue-500/30 transition-all"
                                >
                                    🔊 Listen
                                </button>
                            </div>
                            <p className="text-gray-300 leading-relaxed text-sm whitespace-pre-wrap">
                                {originalText}
                            </p>
                        </div>

                        {/* Simplified */}
                        {simplifiedText && (
                            <div className="glass-card p-6 space-y-3 glow-green">
                                <div className="flex items-center justify-between">
                                    <h3 className="font-semibold text-green-300">
                                        ✨ Simplified
                                    </h3>
                                    <button
                                        onClick={() => speakText(simplifiedText)}
                                        className="text-sm px-3 py-1 rounded-lg bg-green-500/20 text-green-300 hover:bg-green-500/30 transition-all"
                                    >
                                        🔊 Listen
                                    </button>
                                </div>
                                <p className="text-gray-300 leading-relaxed text-sm whitespace-pre-wrap">
                                    {simplifiedText}
                                </p>
                            </div>
                        )}
                    </div>
                )}

                <canvas ref={canvasRef} className="hidden" />
            </div>
        </div>
    );
}
