import { NextRequest, NextResponse } from 'next/server';

/* ── CORS helpers ──────────────────────────────────────────── */

const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
};

export async function OPTIONS() {
    return NextResponse.json(null, { headers: corsHeaders });
}

/**
 * Flesch-Kincaid Grade Level calculation — runs entirely server-side,
 * no AI dependency needed.
 */

function countSyllables(word: string): number {
    word = word.toLowerCase().replace(/[^a-z]/g, '');
    if (word.length <= 2) return 1;

    let count = 0;
    const vowels = 'aeiouy';
    let prevVowel = false;

    for (let i = 0; i < word.length; i++) {
        const isVowel = vowels.includes(word[i]);
        if (isVowel && !prevVowel) count++;
        prevVowel = isVowel;
    }

    // Adjust for silent 'e'
    if (word.endsWith('e') && count > 1) count--;
    // Adjust for -le endings
    if (word.endsWith('le') && word.length > 2 && !vowels.includes(word[word.length - 3])) count++;

    return Math.max(count, 1);
}

function analyzeText(text: string) {
    const sentences = text.split(/[.!?]+/).filter(s => s.trim().length > 0);
    const words = text.split(/\s+/).filter(w => w.replace(/[^a-zA-Z]/g, '').length > 0);
    const totalSyllables = words.reduce((sum, w) => sum + countSyllables(w), 0);

    const sentenceCount = Math.max(sentences.length, 1);
    const wordCount = Math.max(words.length, 1);

    // Flesch-Kincaid Grade Level
    const gradeLevel = 0.39 * (wordCount / sentenceCount) + 11.8 * (totalSyllables / wordCount) - 15.59;

    // Flesch Reading Ease (0-100, higher = easier)
    const readingEase = 206.835 - 1.015 * (wordCount / sentenceCount) - 84.6 * (totalSyllables / wordCount);

    // Determine difficulty label
    let difficulty: string;
    let color: string;
    if (gradeLevel <= 5) { difficulty = 'Easy'; color = 'green'; }
    else if (gradeLevel <= 8) { difficulty = 'Medium'; color = 'yellow'; }
    else if (gradeLevel <= 12) { difficulty = 'Hard'; color = 'orange'; }
    else { difficulty = 'Very Hard'; color = 'red'; }

    return {
        gradeLevel: Math.round(Math.max(gradeLevel, 0) * 10) / 10,
        readingEase: Math.round(Math.min(Math.max(readingEase, 0), 100) * 10) / 10,
        difficulty,
        color,
        wordCount,
        sentenceCount,
        avgSyllablesPerWord: Math.round((totalSyllables / wordCount) * 100) / 100,
        suggestSimplify: gradeLevel > 8,
    };
}

export async function POST(req: NextRequest) {
    try {
        const { text } = await req.json();

        if (!text || text.trim().length === 0) {
            return NextResponse.json(
                { error: 'Missing text' },
                { status: 400 }
            );
        }

        const analysis = analyzeText(text);
        return NextResponse.json(analysis);
    } catch (error: any) {
        console.error('Reading level API error:', error);
        return NextResponse.json(
            { error: error.message || 'Internal server error' },
            { status: 500 }
        );
    }
}
