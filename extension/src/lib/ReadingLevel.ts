// ============================================================
// ReadingLevel.ts — Flesch-Kincaid readability calculator
// ============================================================

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

    if (word.endsWith('e') && count > 1) count--;
    if (word.endsWith('le') && word.length > 2 && !vowels.includes(word[word.length - 3])) count++;

    return Math.max(count, 1);
}

export interface ReadingLevelResult {
    gradeLevel: number;
    readingEase: number;
    difficulty: 'Easy' | 'Medium' | 'Hard' | 'Very Hard';
    color: string;
    suggestSimplify: boolean;
}

export function analyzeReadingLevel(text: string): ReadingLevelResult {
    const sentences = text.split(/[.!?]+/).filter(s => s.trim().length > 0);
    const words = text.split(/\s+/).filter(w => w.replace(/[^a-zA-Z]/g, '').length > 0);
    const totalSyllables = words.reduce((sum, w) => sum + countSyllables(w), 0);

    const sentenceCount = Math.max(sentences.length, 1);
    const wordCount = Math.max(words.length, 1);

    const gradeLevel = 0.39 * (wordCount / sentenceCount) + 11.8 * (totalSyllables / wordCount) - 15.59;
    const readingEase = 206.835 - 1.015 * (wordCount / sentenceCount) - 84.6 * (totalSyllables / wordCount);

    let difficulty: ReadingLevelResult['difficulty'];
    let color: string;
    if (gradeLevel <= 5) { difficulty = 'Easy'; color = '#52B788'; }
    else if (gradeLevel <= 8) { difficulty = 'Medium'; color = '#F4A261'; }
    else if (gradeLevel <= 12) { difficulty = 'Hard'; color = '#E76F51'; }
    else { difficulty = 'Very Hard'; color = '#E63946'; }

    return {
        gradeLevel: Math.round(Math.max(gradeLevel, 0) * 10) / 10,
        readingEase: Math.round(Math.min(Math.max(readingEase, 0), 100) * 10) / 10,
        difficulty,
        color,
        suggestSimplify: gradeLevel > 8,
    };
}
