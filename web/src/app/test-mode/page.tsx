'use client';

import React, { useState, useEffect, useRef } from 'react';

const SAMPLE_TEXT = `
The ancient city of Petra, located in modern-day Jordan, is famous for its rock-cut architecture and water conduit system. 
Another name for Petra is the Rose City due to the color of the stone out of which it is carved. 
Established possibly as early as 312 BC as the capital city of the Arab Nabataeans, it is a symbol of Jordan, as well as Jordan's most-visited tourist attraction.
The Nabataeans were nomadic Arabs who took advantage of Petra's proximity to regional trade routes to establish it as a major trading hub. 
They were particularly praised for their skill in harvesting rain cascading down the mountainous terrain during winter and spring.
`;

const DEFAULT_QUESTIONS = [
    { q: "Where is the ancient city of Petra located?", a: ["Egypt", "Jordan", "Syria"], correct: 1 },
    { q: "What is another name for Petra?", a: ["The Lost City", "The Sand City", "The Rose City"], correct: 2 },
    { q: "The Nabataeans were known for harvesting what?", a: ["Wheat", "Rain", "Gold"], correct: 1 }
];

export default function TestModePage() {
    const [phase, setPhase] = useState<'intro' | 'unsupported_read' | 'unsupported_quiz' | 'supported_intro' | 'supported_read' | 'supported_quiz' | 'results'>('intro');
    const [unsupportedTime, setUnsupportedTime] = useState(0);
    const [supportedTime, setSupportedTime] = useState(0);
    const [unsupportedScore, setUnsupportedScore] = useState(0);
    const [supportedScore, setSupportedScore] = useState(0);

    const [currentQuestionIdx, setCurrentQuestionIdx] = useState(0);
    const [textOptions, setTextOptions] = useState(SAMPLE_TEXT);
    const [questions, setQuestions] = useState(DEFAULT_QUESTIONS);
    const [isGenerating, setIsGenerating] = useState(false);

    const timerRef = useRef<NodeJS.Timeout | null>(null);
    const startTimeRef = useRef<number>(0);

    const startReading = async () => {
        if (phase === 'intro') {
            setIsGenerating(true);
            try {
                const res = await fetch('/api/quiz', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ text: textOptions })
                });
                if (res.ok) {
                    const data = await res.json();
                    if (data.questions && data.questions.length > 0) {
                        setQuestions(data.questions);
                    }
                }
            } catch (e) {
                console.error("Quiz generation error", e);
            } finally {
                setIsGenerating(false);
            }
            startTimeRef.current = Date.now();
            setPhase('unsupported_read');
            setCurrentQuestionIdx(0);
        } else {
            startTimeRef.current = Date.now();
            setPhase('supported_read');
            setCurrentQuestionIdx(0);
        }
    };

    const finishReading = () => {
        const timeSpent = (Date.now() - startTimeRef.current) / 1000;
        if (phase === 'unsupported_read') {
            setUnsupportedTime(timeSpent);
            setPhase('unsupported_quiz');
        } else {
            setSupportedTime(timeSpent);
            setPhase('supported_quiz');
        }
    };

    const answerQuestion = (idx: number) => {
        const isCorrect = idx === questions[currentQuestionIdx].correct;

        if (phase === 'unsupported_quiz') {
            if (isCorrect) setUnsupportedScore(s => s + 1);
        } else {
            if (isCorrect) setSupportedScore(s => s + 1);
        }

        if (currentQuestionIdx < questions.length - 1) {
            setCurrentQuestionIdx(i => i + 1);
        } else {
            if (phase === 'unsupported_quiz') {
                setPhase('supported_intro');
            } else {
                setPhase('results');
            }
        }
    };

    return (
        <main className="max-w-3xl mx-auto px-4 py-12 space-y-8">
            <h1 className="text-3xl font-bold text-center">Reading Speed & Comprehension Test</h1>

            {phase === 'intro' && (
                <div className="text-center space-y-4 bg-white/5 p-8 rounded-2xl border border-white/10">
                    <h2 className="text-xl font-semibold">Phase 1: Without Support</h2>
                    <p className="text-gray-300">
                        Please turn OFF the Dyslexia extension. Paste a text below, or use the default. We will generate a quick test.
                    </p>
                    <textarea
                        className="w-full h-40 p-4 bg-black/20 border border-white/20 rounded-lg text-sm text-gray-200 mt-4 focus:outline-none focus:border-blue-500"
                        value={textOptions}
                        onChange={(e) => setTextOptions(e.target.value)}
                    />
                    <button
                        onClick={startReading}
                        disabled={isGenerating || textOptions.length < 50}
                        className="px-6 py-3 mt-4 bg-blue-500 hover:bg-blue-600 rounded-lg font-medium transition-colors disabled:opacity-50"
                    >
                        {isGenerating ? "Processing AI Quiz..." : "Start Reading"}
                    </button>
                </div>
            )}

            {(phase === 'unsupported_read' || phase === 'supported_read') && (
                <div className="space-y-6">
                    <p className="text-gray-400 text-sm text-center">Take your time. Click "Finished Reading" when done.</p>
                    <div className="bg-white/5 p-8 rounded-2xl text-lg leading-relaxed shadow-lg whitespace-pre-wrap">
                        {textOptions}
                    </div>
                    <div className="flex justify-center">
                        <button onClick={finishReading} className="px-6 py-3 bg-green-500 hover:bg-green-600 rounded-lg font-medium">Finished Reading</button>
                    </div>
                </div>
            )}

            {(phase === 'unsupported_quiz' || phase === 'supported_quiz') && (
                <div className="bg-white/5 p-8 rounded-2xl border border-white/10 space-y-6">
                    <h2 className="text-xl font-semibold">Question {currentQuestionIdx + 1} of {questions.length}</h2>
                    <p className="text-lg">{questions[currentQuestionIdx].q}</p>
                    <div className="flex flex-col gap-3">
                        {questions[currentQuestionIdx].a.map((ans, idx) => (
                            <button key={idx} onClick={() => answerQuestion(idx)} className="p-4 text-left bg-white/5 hover:bg-white/10 border border-white/10 rounded-lg transition-colors">
                                {ans}
                            </button>
                        ))}
                    </div>
                </div>
            )}

            {phase === 'supported_intro' && (
                <div className="text-center space-y-4 bg-white/5 p-8 rounded-2xl border border-purple-500/30">
                    <h2 className="text-xl font-semibold text-purple-300">Phase 2: With Support</h2>
                    <p className="text-gray-300">
                        Awesome! Now, turn ON the Dyslexia extension. Feel free to use the Ruler, Simplifier, definitions, or TTS while reading the same text again.
                    </p>
                    <button onClick={startReading} className="px-6 py-3 bg-purple-500 hover:bg-purple-600 rounded-lg font-medium transition-colors">Start Supported Reading</button>
                </div>
            )}

            {phase === 'results' && (
                <div className="space-y-6">
                    <h2 className="text-2xl font-bold text-center mb-8 bg-gradient-to-r from-blue-400 to-green-400 bg-clip-text text-transparent">Your Reading Analytics</h2>

                    <div className="grid grid-cols-2 gap-4">
                        <div className="bg-white/5 p-6 rounded-2xl border border-gray-600">
                            <h3 className="text-lg font-semibold mb-2">Without Support</h3>
                            <p>Time: <strong className="text-xl">{unsupportedTime.toFixed(1)}s</strong></p>
                            <p>Score: <strong className="text-xl">{unsupportedScore}/3</strong></p>
                        </div>
                        <div className="bg-white/5 p-6 rounded-2xl border border-purple-500/50">
                            <h3 className="text-lg font-semibold text-purple-300 mb-2">With Support</h3>
                            <p>Time: <strong className="text-xl">{supportedTime.toFixed(1)}s</strong></p>
                            <p>Score: <strong className="text-xl">{supportedScore}/3</strong></p>
                        </div>
                    </div>

                    <div className="text-center mt-6">
                        {supportedScore > unsupportedScore && <p className="text-green-400 text-lg">Your comprehension improved with the extension! 🎉</p>}
                        {supportedTime < unsupportedTime && <p className="text-blue-400 text-lg">You read {((unsupportedTime - supportedTime) / unsupportedTime * 100).toFixed(0)}% faster with the extension! 🚀</p>}
                    </div>

                    <div className="flex justify-center mt-8">
                        <button onClick={() => setPhase('intro')} className="px-6 py-2 bg-white/10 hover:bg-white/20 rounded-lg">Retest</button>
                    </div>
                </div>
            )}

        </main>
    );
}
