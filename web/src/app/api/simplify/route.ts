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

/* ── Multi-level simplification prompts ────────────────────── */

const LEVEL_PROMPTS: Record<string, string> = {
    '1': 'Slightly simplify the text. Keep most words but shorten long sentences.',
    '2': 'Rewrite in clear, easy English. Replace hard words. Use short sentences.',
    '3': 'Rewrite for a young child. Use the simplest words possible. Very short sentences.',
};

/* ── Mode-based system prompts ─────────────────────────────── */

const SYSTEM_PROMPTS: Record<string, string> = {
    simplify: `You are a reading assistant for people with dyslexia. Simplify the given text:
- Replace difficult words with simpler alternatives
- Break long sentences into shorter ones
- Use simple grammar
- Keep the same meaning
- Do NOT add explanations, just return the simplified text`,

    summarize: `You are a reading assistant for people with dyslexia. Summarize the text in 2-3 simple sentences. Use easy words.`,

    breakdown: `You are a reading assistant for people with dyslexia. Break down this text into small, easy-to-read chunks:
- Number each chunk
- Each chunk should be one simple idea
- Use simple words
- Keep it short`,

    bullet_summary: `You are a reading assistant for people with dyslexia. Create a bullet-point summary:
- Extract key points
- Use simple language
- Each bullet = one idea
- Use • for bullets
- No more than 6 bullets`,

    key_takeaways: `You are a reading assistant. Extract the 3-5 most important takeaways from this text.
- Number each takeaway
- Use very simple language
- One sentence each`,

    rephrase: `You are a reading assistant. Rephrase this text in a completely different way while keeping the same meaning. Use simpler sentence structure and everyday language. Do NOT add any explanations—just return the rephrased text.`,

    academic_to_plain: `You are a reading assistant. Convert this academic/technical text to plain English that anyone can understand:
- Replace all jargon with everyday words
- Break complex ideas into simple steps
- Use "you" and "we" to make it friendly
- If there are abbreviations, spell them out
- Just return the rewritten text, no commentary`,

    explain_sentence: `You are a reading assistant for people with dyslexia. Explain this sentence in very simple terms:
- First give a one-line simple meaning
- Then explain WHY it means that (1-2 lines)
- Use a real-world analogy if helpful
- Keep everything very simple`,

    mindmap: `You are a reading assistant. Analyze this text and create a structured mindmap highlighting the core concepts and subtopics.
Return ONLY a valid JSON object matching this structure. Do NOT include markdown formatting, code blocks (no \`\`\`json), or any conversational filler.
{
  "main_topic": "The main subject of the text (max 4-5 words)",
  "subtopics": [
    {
      "topic": "Key Subtopic",
      "details": ["Concise detail 1", "Concise detail 2"]
    }
  ]
}
Ensure the "main_topic" is a brief title. Each subtopic should have 1-3 concise details.
`,
};

export async function POST(req: NextRequest) {
    try {
        const body = await req.json();
        const { text, mode, level, context } = body;

        if (!text) {
            console.error('Simplify API: Missing text in body:', body);
            return NextResponse.json(
                { error: 'Missing text' },
                { status: 400 }
            );
        }

        const actualMode = mode || 'simplify';

        // Build the system prompt — incorporate level if provided
        let systemPrompt = SYSTEM_PROMPTS[actualMode];
        if (!systemPrompt) {
            return NextResponse.json(
                { error: `Invalid mode: ${actualMode}` },
                { status: 400 }
            );
        }

        // For simplify mode, prepend the level instruction
        if (actualMode === 'simplify' && level && LEVEL_PROMPTS[String(level)]) {
            systemPrompt = `${LEVEL_PROMPTS[String(level)]}\n\n${systemPrompt}`;
        }

        const formatSpecifier = actualMode === 'mindmap' ? 'json' : '';

        // Build the user prompt including context if available
        let userPrompt = `Text: ${text}`;
        if (context && context !== text) {
            userPrompt = `Broader context (for reference):\n"${context}"\n\nText to process: ${text}`;
        }

        const response = await fetch(`${OLLAMA_URL}/api/generate`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                model: 'llama3',
                prompt: `${systemPrompt}\n\n${userPrompt}`,
                stream: false,
                format: formatSpecifier,
                options: {
                    temperature: 0.3,
                    top_p: 0.9,
                    num_predict: 512,
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

        if (actualMode === 'mindmap') {
            try {
                const mindmapData = JSON.parse(data.response);
                return NextResponse.json({ result: 'mindmap_render', mindmapData });
            } catch (e) {
                console.error("Failed to parse mindmap JSON", data.response);
                return NextResponse.json({ error: 'Failed to generate mindmap structure' }, { status: 500 });
            }
        }

        return NextResponse.json({ result: data.response });
    } catch (error: any) {
        console.error('Simplify API error:', error);
        return NextResponse.json(
            { error: error.message || 'Internal server error' },
            { status: 500 }
        );
    }
}
