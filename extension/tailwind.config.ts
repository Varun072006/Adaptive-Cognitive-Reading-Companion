import type { Config } from 'tailwindcss';

const config: Config = {
    content: ['./src/**/*.{ts,tsx,html}'],
    theme: {
        extend: {
            fontFamily: {
                dyslexic: ['OpenDyslexic', 'Comic Sans MS', 'sans-serif'],
                lexie: ['Lexie Readable', 'Verdana', 'sans-serif'],
                reader: ['var(--font-reader)', 'sans-serif'],
            },
            colors: {
                cream: '#FFF8F0',
                warmgray: '#F5F0EB',
                accent: {
                    blue: '#4A90D9',
                    green: '#52B788',
                    orange: '#F4A261',
                    purple: '#7B68EE',
                },
                surface: {
                    dark: '#1A1A2E',
                    card: '#16213E',
                    hover: '#0F3460',
                },
            },
            animation: {
                'fade-in': 'fadeIn 0.3s ease-out',
                'slide-up': 'slideUp 0.3s ease-out',
                'pulse-gentle': 'pulseGentle 2s ease-in-out infinite',
            },
            keyframes: {
                fadeIn: {
                    '0%': { opacity: '0' },
                    '100%': { opacity: '1' },
                },
                slideUp: {
                    '0%': { opacity: '0', transform: 'translateY(10px)' },
                    '100%': { opacity: '1', transform: 'translateY(0)' },
                },
                pulseGentle: {
                    '0%, 100%': { opacity: '1' },
                    '50%': { opacity: '0.7' },
                },
            },
        },
    },
    plugins: [],
};

export default config;
