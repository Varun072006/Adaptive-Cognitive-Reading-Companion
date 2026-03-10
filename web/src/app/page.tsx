export default function Home() {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center px-6">
      {/* Hero Section */}
      <section className="text-center max-w-3xl mx-auto py-20 space-y-8">
        <div className="text-6xl mb-4">📖</div>
        <h1 className="text-5xl font-bold gradient-text leading-tight">
          Adaptive Cognitive
          <br />
          Reading Companion
        </h1>
        <p className="text-xl text-gray-400 max-w-2xl mx-auto leading-relaxed">
          An intelligent reading assistant that adapts to your needs. Visual
          aids, text-to-speech, AI simplification, and smart struggle detection
          — all designed for dyslexic learners.
        </p>

        <div className="flex gap-4 justify-center pt-4">
          <a
            href="/scanner"
            className="px-8 py-3 rounded-xl font-semibold text-white bg-gradient-to-r from-blue-500 to-purple-500 hover:from-blue-600 hover:to-purple-600 transition-all shadow-lg glow-blue"
          >
            📷 Open Scanner
          </a>
          <a
            href="/dashboard"
            className="px-8 py-3 rounded-xl font-semibold text-gray-300 glass-card hover:bg-white/10 transition-all"
          >
            📊 View Progress
          </a>
        </div>
      </section>

      {/* Feature Grid */}
      <section className="max-w-5xl mx-auto py-16 px-6">
        <h2 className="text-3xl font-bold text-center mb-12 gradient-text">
          How It Helps
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {[
            {
              icon: "✨",
              title: "Smart Word Highlight",
              desc: "Words enlarge and bold on hover, making each word easier to focus on.",
              color: "blue",
            },
            {
              icon: "📏",
              title: "Reading Ruler",
              desc: "A guide line follows your cursor to help track the current line.",
              color: "green",
            },
            {
              icon: "🔦",
              title: "Line Focus",
              desc: "Dims everything except the line you're reading to reduce visual noise.",
              color: "purple",
            },
            {
              icon: "🔊",
              title: "Text-to-Speech",
              desc: "Click any word to hear it spoken. Play entire paragraphs with word sync.",
              color: "orange",
            },
            {
              icon: "🧠",
              title: "Struggle Detection",
              desc: "Detects when you're struggling and gently offers help automatically.",
              color: "blue",
            },
            {
              icon: "📖",
              title: "AI Simplification",
              desc: "Complex text simplified into easy words and shorter sentences by Llama 3.",
              color: "purple",
            },
            {
              icon: "📷",
              title: "OCR Scanner",
              desc: "Point your camera at text or upload an image — instantly readable and simplified.",
              color: "green",
            },
            {
              icon: "🎯",
              title: "Dyslexia Fonts",
              desc: "Switch to OpenDyslexic or Lexie Readable fonts with one click.",
              color: "orange",
            },
            {
              icon: "📊",
              title: "Progress Tracking",
              desc: "Track reading speed, words read, and celebrate your improvements.",
              color: "blue",
            },
          ].map(({ icon, title, desc, color }) => (
            <div
              key={title}
              className={`glass-card p-6 space-y-3 hover:scale-[1.02] transition-transform cursor-default glow-${color}`}
            >
              <div className="text-3xl">{icon}</div>
              <h3 className="text-lg font-semibold text-white">{title}</h3>
              <p className="text-sm text-gray-400 leading-relaxed">{desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Setup Instructions */}
      <section className="max-w-3xl mx-auto py-16 px-6 text-center space-y-6">
        <h2 className="text-3xl font-bold gradient-text">Get Started</h2>
        <div className="glass-card p-8 text-left space-y-4">
          <div className="flex gap-3 items-start">
            <span className="text-blue-400 font-bold text-lg">1.</span>
            <div>
              <p className="font-semibold text-white">Install the Chrome Extension</p>
              <p className="text-sm text-gray-400">
                Load the <code className="text-blue-400">extension/dist</code> folder as an unpacked extension
              </p>
            </div>
          </div>
          <div className="flex gap-3 items-start">
            <span className="text-blue-400 font-bold text-lg">2.</span>
            <div>
              <p className="font-semibold text-white">Start Ollama</p>
              <p className="text-sm text-gray-400">
                Run <code className="text-blue-400">ollama run llama3</code> to start the AI engine
              </p>
            </div>
          </div>
          <div className="flex gap-3 items-start">
            <span className="text-blue-400 font-bold text-lg">3.</span>
            <div>
              <p className="font-semibold text-white">Browse Any Website</p>
              <p className="text-sm text-gray-400">
                The extension activates automatically with reading aids and struggle detection
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="py-8 text-center text-sm text-gray-500">
        <p>
          Built with ❤️ for dyslexic learners — 100% open-source &amp; free
        </p>
      </footer>
    </div>
  );
}
