import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";

const inter = Inter({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Adaptive Cognitive Reading Companion",
  description:
    "Intelligent reading assistant for people with dyslexia — visual aids, TTS, AI simplification, OCR scanning, and struggle detection.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className={`${inter.variable} antialiased`}>
        {/* Navigation */}
        <nav className="fixed top-0 left-0 right-0 z-50 glass-card border-b border-white/10 px-6 py-3">
          <div className="max-w-6xl mx-auto flex items-center justify-between">
            <a href="/" className="flex items-center gap-2">
              <span className="text-2xl">📖</span>
              <span className="text-lg font-bold gradient-text">ACRC</span>
            </a>
            <div className="flex items-center gap-6 text-sm">
              <a
                href="/scanner"
                className="text-gray-400 hover:text-white transition-colors"
              >
                📷 Scanner
              </a>
              <a
                href="/dashboard"
                className="text-gray-400 hover:text-white transition-colors"
              >
                📊 Dashboard
              </a>
            </div>
          </div>
        </nav>

        <main className="pt-16">{children}</main>
      </body>
    </html>
  );
}
