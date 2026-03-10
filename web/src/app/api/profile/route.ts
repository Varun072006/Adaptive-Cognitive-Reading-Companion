import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '../../../lib/db';

const OLLAMA_URL = process.env.OLLAMA_URL || 'http://localhost:11434';

export async function POST(req: NextRequest) {
    try {
        const body = await req.json();
        const { extensionId, progressData } = body;

        if (!extensionId || !progressData) {
            return NextResponse.json({ error: 'Missing required data' }, { status: 400 });
        }

        // Generate AI Insight
        const confusedWords = Object.keys(progressData.confusedWordsMap).slice(0, 10).join(', ');

        const systemPrompt = `You are an expert reading coach. Analyze this dyslexic reader's data and write a short, encouraging 2-sentence summary of their learning profile:
- Total sessions: ${progressData.totalSessions}
- Words read: ${progressData.totalWordsRead}
- Frequent difficult words: ${confusedWords || 'none yet'}
Speak directly to the reader in a supportive tone.`;

        let aiInsight = "Keep up the great work! Your reading journey is just beginning.";

        try {
            const aiRes = await fetch(`${OLLAMA_URL}/api/generate`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    model: 'llama3',
                    prompt: systemPrompt,
                    stream: false,
                    options: { temperature: 0.7, num_predict: 150 },
                }),
            });
            if (aiRes.ok) {
                const aiData = await aiRes.json();
                aiInsight = aiData.response;
            }
        } catch (e) {
            console.error("Failed to generate AI learning profile insight", e);
        }

        // Save to Local MySQL via Prisma
        await prisma.userProfile.upsert({
            where: { extensionId },
            update: {
                totalSessions: progressData.totalSessions,
                totalWords: progressData.totalWordsRead,
                totalTimeMin: progressData.totalTimeMinutes,
                streakDays: progressData.streakDays,
                confusedWords: progressData.confusedWordsMap as any,
                dailyStats: progressData.dailyStats as any,
                aiInsight,
            },
            create: {
                extensionId,
                totalSessions: progressData.totalSessions,
                totalWords: progressData.totalWordsRead,
                totalTimeMin: progressData.totalTimeMinutes,
                streakDays: progressData.streakDays,
                confusedWords: progressData.confusedWordsMap as any,
                dailyStats: progressData.dailyStats as any,
                aiInsight,
            }
        });

        return NextResponse.json({ success: true, aiInsight });
    } catch (error: any) {
        console.error('Profile sync error:', error);
        return NextResponse.json(
            { error: error.message || 'Internal server error' },
            { status: 500 }
        );
    }
}
