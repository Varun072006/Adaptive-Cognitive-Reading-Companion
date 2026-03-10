import { NextRequest, NextResponse } from 'next/server';

const OCR_SERVICE_URL = process.env.OCR_SERVICE_URL || 'http://localhost:8866';

/* ── CORS helpers ──────────────────────────────────────────── */

const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
};

export async function OPTIONS() {
    return NextResponse.json(null, { headers: corsHeaders });
}
const OLLAMA_URL = process.env.OLLAMA_URL || 'http://localhost:11434';

export async function POST(req: NextRequest) {
    try {
        const formData = await req.formData();
        const image = formData.get('image') as File | null;
        const simplify = formData.get('simplify') === 'true';

        if (!image) {
            return NextResponse.json(
                { error: 'No image provided' },
                { status: 400 }
            );
        }

        // Forward image to PaddleOCR service
        const ocrFormData = new FormData();
        ocrFormData.append('image', image);

        const ocrResponse = await fetch(`${OCR_SERVICE_URL}/predict`, {
            method: 'POST',
            body: ocrFormData,
        });

        if (!ocrResponse.ok) {
            const errText = await ocrResponse.text();
            return NextResponse.json(
                { error: `OCR service error: ${errText}` },
                { status: 502 }
            );
        }

        const ocrData = await ocrResponse.json();
        const extractedText = ocrData.text || '';

        if (!extractedText.trim()) {
            return NextResponse.json({
                original: '',
                simplified: '',
                error: 'No text detected in image',
            });
        }

        let simplified = '';

        // Optionally simplify the extracted text
        if (simplify && extractedText.trim()) {
            const llamaResponse = await fetch(`${OLLAMA_URL}/api/generate`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    model: 'llama3',
                    prompt: `You are a reading assistant for people with dyslexia. Simplify the following text using simpler words and shorter sentences. Keep the same meaning. Only return the simplified text.\n\nText: ${extractedText}`,
                    stream: false,
                    options: {
                        temperature: 0.3,
                        num_predict: 512,
                    },
                }),
            });

            if (llamaResponse.ok) {
                const llamaData = await llamaResponse.json();
                simplified = llamaData.response || '';
            }
        }

        return NextResponse.json({
            original: extractedText,
            simplified,
            boxes: ocrData.boxes || [],
        });
    } catch (error: any) {
        console.error('OCR API error:', error);
        return NextResponse.json(
            { error: error.message || 'Internal server error' },
            { status: 500 }
        );
    }
}
