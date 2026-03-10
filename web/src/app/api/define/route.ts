import { NextRequest, NextResponse } from 'next/server';

const OLLAMA_URL = process.env.OLLAMA_URL || 'http://localhost:11434';

/* ── CORS helpers ──────────────────────────────────────────── */

const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
};

export async function OPTIONS() {
    return NextResponse.json(null, { headers: corsHeaders });
}

export async function POST(req: NextRequest) {
    try {
        const { word, context } = await req.json();

        if (!word) {
            return NextResponse.json(
                { error: 'Missing word' },
                { status: 400 }
            );
        }

        const contextInstruction = context
            ? `\n\nThe word appears in this context:\n"${context}"\n\nDefine the word SPECIFICALLY as it is used in this context.`
            : '';

        const prompt = `You are a reading assistant for people with dyslexia. Define this word simply and helpfully.${contextInstruction}

Word: "${word}"

Respond in EXACTLY this JSON format (no markdown, no code fences):
{"definition": "simple meaning in 1 sentence", "pronunciation": "how to say it phonetically", "example": "simple example sentence using the word", "synonyms": ["simpler word 1", "simpler word 2", "simpler word 3"], "analogy": "a real-world analogy to help understand (1 sentence)", "is_abbreviation": false, "expanded_form": ""}

If the word is an abbreviation, set is_abbreviation to true and provide the expanded_form.`;

        const response = await fetch(`${OLLAMA_URL}/api/generate`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                model: 'llama3',
                prompt,
                stream: false,
                format: 'json',
                options: {
                    temperature: 0.2,
                    num_predict: 300,
                },
            }),
        });

        if (!response.ok) {
            const errText = await response.text();
            return NextResponse.json(
                { error: `Ollama error: ${errText}` },
                { status: 502 }
            );
        }

        const data = await response.json();

        try {
            const parsed = JSON.parse(data.response);
            return NextResponse.json({
                definition: parsed.definition || 'No definition available',
                pronunciation: parsed.pronunciation || '',
                example: parsed.example || '',
                synonyms: parsed.synonyms || [],
                analogy: parsed.analogy || '',
                is_abbreviation: parsed.is_abbreviation || false,
                expanded_form: parsed.expanded_form || '',
            });
        } catch {
            return NextResponse.json({
                definition: data.response,
                pronunciation: '',
                example: '',
                synonyms: [],
                analogy: '',
                is_abbreviation: false,
                expanded_form: '',
            });
        }
    } catch (error: any) {
        console.error('Define API error:', error);
        return NextResponse.json(
            { error: error.message || 'Internal server error' },
            { status: 500 }
        );
    }
}
