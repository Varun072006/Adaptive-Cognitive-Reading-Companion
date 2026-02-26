"""
PaddleOCR Microservice — FastAPI server for text extraction from images.
Run: uvicorn main:app --host 0.0.0.0 --port 8866
"""

import io
import logging
from fastapi import FastAPI, File, UploadFile, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from PIL import Image
import numpy as np

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

app = FastAPI(
    title="ACRC OCR Service",
    description="PaddleOCR microservice for the Adaptive Cognitive Reading Companion",
    version="1.0.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Lazy-load PaddleOCR to avoid slow startup
_ocr_engine = None


def get_ocr_engine():
    global _ocr_engine
    if _ocr_engine is None:
        from paddleocr import PaddleOCR
        _ocr_engine = PaddleOCR(
            use_angle_cls=True,
            lang="en",
            show_log=False,
        )
        logger.info("PaddleOCR engine initialized")
    return _ocr_engine


@app.get("/health")
async def health():
    return {"status": "ok"}


@app.post("/predict")
async def predict(image: UploadFile = File(...)):
    """
    Extract text from an uploaded image using PaddleOCR.
    Returns extracted text and bounding boxes.
    """
    if not image.content_type or not image.content_type.startswith("image/"):
        raise HTTPException(status_code=400, detail="File must be an image")

    try:
        contents = await image.read()
        img = Image.open(io.BytesIO(contents)).convert("RGB")
        img_array = np.array(img)

        ocr = get_ocr_engine()
        results = ocr.ocr(img_array, cls=True)

        if not results or not results[0]:
            return {"text": "", "boxes": []}

        lines = []
        boxes = []

        for line in results[0]:
            bbox, (text, confidence) = line
            lines.append(text)
            boxes.append({
                "text": text,
                "confidence": round(confidence, 3),
                "bbox": [[int(p[0]), int(p[1])] for p in bbox],
            })

        full_text = " ".join(lines)

        return {
            "text": full_text,
            "boxes": boxes,
            "line_count": len(lines),
        }

    except Exception as e:
        logger.error(f"OCR processing error: {e}")
        raise HTTPException(status_code=500, detail=str(e))


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8866)
