import { NextRequest, NextResponse } from 'next/server';

const OLLAMA_URL = process.env.OLLAMA_URL || 'http://localhost:11434';

export async function POST(req: NextRequest) {
    try {
        const { text } = await req.json();

        if (!text || text.trim().length < 50) {
            return NextResponse.json({ error: 'Please provide at least a short paragraph of text.' }, { status: 400 });
        }

        const systemPrompt = `You are a reading comprehension tutor. Analyze the following text and create exactly 3 multiple choice questions to test the user's understanding.
Return ONLY a valid JSON array of objects. Do not include markdown formatting, backticks, or any other explanations. The format MUST be exactly:
[
  {
    "q": "Question text here?",
    "a": ["Option 1", "Option 2", "Option 3"],
    "correct": 0
  }
]
Note that "correct" is the integer index (0, 1, or 2) of the correct answer in the "a" array.`;

        const response = await fetch(`${OLLAMA_URL}/api/generate`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                model: 'llama3',
                prompt: `${systemPrompt}\n\nText: ${text}`,
                stream: false,
                format: 'json',
                options: {
                    temperature: 0.3,
                    num_predict: 500,
                },
            }),
        });

        if (!response.ok) {
            return NextResponse.json({ error: `Ollama API failed with status ${response.status}` }, { status: response.status });
        }

        const data = await response.json();

        try {
            const quizData = JSON.parse(data.response);
            return NextResponse.json({ questions: quizData });
        } catch (e) {
            console.error("Failed to parse quiz JSON", data.response);
            return NextResponse.json({ error: 'Failed to generate valid quiz structure' }, { status: 500 });
        }
    } catch (error: any) {
        console.error('Quiz API error:', error);
        return NextResponse.json(
            { error: error.message || 'Internal server error' },
            { status: 500 }
        );
    }
}
