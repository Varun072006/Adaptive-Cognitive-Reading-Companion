# 📖 Adaptive Cognitive Reading Companion (ACRC)

An intelligent reading assistant designed for people with **dyslexia**. It uses visual aids, real-time struggle detection, AI-powered text simplification, OCR scanning, text-to-speech, and webcam-based eye tracking — all running **locally** for maximum privacy.

---

## ✨ Core Features

### 🔤 Smart Word Interaction (Chrome Extension)
- **Hover to Highlight** — Cursor over any word → it becomes **bold + bigger** (1.15× scale)
- **Click to Speak** — Click any word → hear it spoken aloud via TTS
- **Struggle Detection** — Hover on a word for 2+ seconds → AI help popup appears automatically
- **Re-reading Detection** — Scrolls back repeatedly? The extension notices and offers help
- **Idle Detection** — Paused for 8+ seconds → gentle nudge with assistance options

### 🧠 AI-Powered Help Popup
When struggling is detected, a popup offers **7 instant actions**:
| Action | Description |
|--------|-------------|
| 🔊 Read | Speaks the word aloud |
| 💡 Define | Shows meaning, pronunciation, synonyms, analogy |
| 📖 Simplify | Rewrites the sentence in simpler words |
| 🧠 Explain | Explains what the sentence means |
| ✂️ Break Down | Splits into small numbered chunks |
| 🔄 Rephrase | Rewrites it a completely different way |
| 📋 Bullets | Summarizes as bullet points |

3 simplification levels: 🟢 Easy → 🟡 Simpler → 🔴 Simplest

### 📏 Reading Aids
- **Reading Ruler** — Horizontal guide line follows your cursor
- **Line Focus** — Dims everything except the current line
- **Paragraph Isolation** — Blurs all paragraphs except the one you're hovering
- **Ad & Sidebar Hiding** — Removes distracting page elements

### 🔤 Typography Controls
- **Dyslexia-friendly fonts** — OpenDyslexic, Lexie Readable, or system font
- **Adjustable sizing** — Font size (80%–150%), letter/word spacing, line height
- **Visual themes** — Dark mode, high contrast, cream/sky/mint backgrounds
- **Custom highlight color** — 6 color options for word highlights

### 👁️ Eye Tracking (WebGazer.js)
- **Webcam-based gaze tracking** — Detects where your eyes are looking
- **Fixation detection** — Eyes stuck on a word for 3+ seconds → triggers help popup
- **Gaze dot visualization** — Small pink dot shows where you're looking
- **Privacy-first** — Only activates when Camera Access is toggled ON
- **Zero persistence** — No gaze data is saved

### 📷 OCR Scanner (Web App)
- **Camera capture** — Point at text, capture, and extract instantly
- **Image upload** — Upload JPG, PNG, or PDF files
- **PaddleOCR** — Industrial-grade OCR engine running locally
- **Auto-simplify** — Extracted text is automatically simplified by Llama 3
- **Read aloud** — Listen to both original and simplified text

### 📊 Progress Dashboard
- **Reading stats** — Words read, sessions completed, reading streaks
- **Session history** — Scrollable log of past reading sessions
- **Tricky Words** — Frequently confused words ranked by frequency
- **Milestones** — Achievements for reading goals

---

## 🏗️ Architecture

```
┌─────────────────────────────────────────────┐
│             Chrome Extension                 │
│  ┌──────────┬──────────┬──────────────────┐ │
│  │ Content  │  Popup   │ Service Worker   │ │
│  │ Script   │  (React) │ (Background)     │ │
│  ├──────────┴──────────┴──────────────────┤ │
│  │ DomParser · StruggleDetector · TTS     │ │
│  │ ReaderOverlay · StrugglePopup · Gaze   │ │
│  └────────────────────────────────────────┘ │
│                    │ API calls               │
│                    ▼                         │
│  ┌────────────────────────────────────────┐ │
│  │         Next.js Web App (:3000)        │ │
│  │  /api/simplify  /api/define            │ │
│  │  /api/ocr       /api/reading-level     │ │
│  │  /dashboard     /scanner               │ │
│  └────────────┬───────────────┬───────────┘ │
│               │               │             │
│               ▼               ▼             │
│  ┌────────────────┐  ┌────────────────────┐ │
│  │ Ollama (Llama3)│  │ PaddleOCR Service  │ │
│  │    :11434      │  │     :8866          │ │
│  └────────────────┘  └────────────────────┘ │
└─────────────────────────────────────────────┘
```

**Tech Stack:**
- **Extension**: Vite + React + TypeScript, Chrome MV3
- **Web App**: Next.js 16 (App Router) + TypeScript + TailwindCSS v4
- **OCR**: Python FastAPI + PaddleOCR
- **AI**: Ollama (Llama 3) — 100% local, no cloud

---

## 🚀 Quick Start

### Prerequisites
- Node.js 18+
- Python 3.8+
- [Ollama](https://ollama.com) installed with `llama3` model
- Chrome browser

### 1. Clone & Install

```bash
# Install extension dependencies
cd extension
npm install

# Install web app dependencies
cd ../web
npm install

# Install OCR service dependencies
cd ../ocr-service
pip install -r requirements.txt
```

### 2. Start All Services

Open **3 terminal windows**:

```bash
# Terminal 1: Ollama AI
ollama run llama3

# Terminal 2: OCR Service
cd ocr-service
uvicorn main:app --port 8866

# Terminal 3: Web App
cd web
npm run dev
```

### 3. Build & Load Extension

```bash
# Build the extension
cd extension
npm run build
```

Then in Chrome:
1. Go to `chrome://extensions/`
2. Enable **Developer mode** (top-right toggle)
3. Click **Load unpacked** → select `extension/dist` folder
4. Pin the 📖 icon in your toolbar

### 4. Start Reading!
- Browse any website → extension activates automatically
- Visit http://localhost:3000 for the web dashboard & scanner

---

## 📁 Project Structure

```
Dyslexia_adaptive_learner/
├── extension/                    # Chrome Extension (Vite + React + TS)
│   ├── src/
│   │   ├── content/              # Content script (injected into pages)
│   │   │   ├── index.tsx         # Main app — mounts overlay + popup
│   │   │   ├── DomParser.ts      # Wraps words in spans for interaction
│   │   │   ├── StruggleDetector.ts   # Detects reading difficulties
│   │   │   ├── StrugglePopup.tsx # AI help popup component
│   │   │   ├── ReaderOverlay.tsx # Ruler + line focus overlay
│   │   │   ├── GazeTracker.ts    # WebGazer.js eye tracking
│   │   │   ├── TTSEngine.ts      # Text-to-speech engine
│   │   │   └── styles.css        # Hover, gaze dot, webcam styles
│   │   ├── popup/                # Extension popup UI
│   │   │   ├── Popup.tsx         # 6-tab settings interface
│   │   │   ├── main.tsx          # React entry point
│   │   │   └── popup.html        # HTML shell
│   │   ├── background/
│   │   │   └── service-worker.ts # Session tracking & stats
│   │   └── lib/
│   │       ├── constants.ts      # Preferences & defaults
│   │       ├── api.ts            # API client for backend
│   │       └── ReadingLevel.ts   # Flesch-Kincaid calculator
│   └── public/manifest.json     # Chrome MV3 manifest
│
├── web/                          # Next.js Web App
│   └── src/app/
│       ├── page.tsx              # Landing page
│       ├── scanner/page.tsx      # OCR scanner (camera + upload)
│       ├── dashboard/page.tsx    # Reading progress dashboard
│       └── api/
│           ├── simplify/route.ts # 8-mode AI simplification
│           ├── define/route.ts   # Word definition + synonyms
│           ├── ocr/route.ts      # OCR → simplify pipeline
│           └── reading-level/route.ts  # Reading difficulty analysis
│
└── ocr-service/                  # PaddleOCR microservice
    └── main.py                   # FastAPI + PaddleOCR
```

---

## 🔒 Privacy

- **All AI runs locally** via Ollama — your text never leaves your computer
- **No cloud services** — everything operates on your machine
- **No tracking** — reading data stored only in Chrome's local storage
- **Camera opt-in** — webcam eye tracking is disabled by default
- **Data clearing** — one-click deletion of all reading data
- **Open source** — fully auditable code

---

## �️ API Endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/simplify` | POST | 8-mode text simplification with 3 difficulty levels |
| `/api/define` | POST | Rich word definitions (pronunciation, synonyms, analogy) |
| `/api/ocr` | POST | Image → text extraction + optional simplification |
| `/api/reading-level` | POST | Flesch-Kincaid readability analysis |

---

## 📄 License

MIT — Built with ❤️ for dyslexic learners
# Adaptive-Cognitive-Reading-Companion
# Adaptive-Cognitive-Reading-Companion
