import type { Config } from 'tailwindcss'

const config: Config = {
  content: [
    './src/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        void: '#08080C',
        panel: '#0D1117',
        'panel-hover': '#131920',
        'input-bg': '#0A0E14',
        'border-ice': '#1a2a3a',
        'border-active': '#2a4a5a',
        ember: { DEFAULT: '#E8453C', light: '#FF6B35' },
        teal: { DEFAULT: '#00D4AA' },
        amber: { DEFAULT: '#D4945A' },
        platinum: '#E0E4E8',
        thermal: {
          cold: '#1a4a8a',
          cool: '#00aadd',
          neutral: '#00D4AA',
          warm: '#FF6B35',
          hot: '#E8453C',
          extreme: '#ff2060',
        }
      },
      fontFamily: {
        display: ['Playfair Display', 'serif'],
        body: ['Inter', 'sans-serif'],
        mono: ['JetBrains Mono', 'monospace'],
      }
    },
  },
  plugins: [],
}
export default config
