/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        // ── Dark mode (Burp Suite inspired) ──────────────────────
        'd-bg':        '#0d0d1a',   // deepest background
        'd-surface':   '#12122b',   // panel background
        'd-surface2':  '#1a1a3e',   // elevated panels
        'd-border':    '#2a2a5a',   // borders
        'd-border2':   '#3a3a7a',   // hover borders
        'd-text':      '#e8e8ff',   // primary text
        'd-muted':     '#8888bb',   // secondary text
        'd-accent':    '#ff6b35',   // Burp orange — primary actions
        'd-teal':      '#00d4aa',   // Burp teal — success/highlight
        'd-purple':    '#a855f7',   // purple accent
        'd-yellow':    '#f59e0b',   // warning

        // ── Light mode ────────────────────────────────────────────
        'l-bg':        '#f0f2f8',
        'l-surface':   '#ffffff',
        'l-surface2':  '#e8ebf5',
        'l-border':    '#c8cce0',
        'l-border2':   '#a8acd0',
        'l-text':      '#1a1a3a',
        'l-muted':     '#5a5a8a',
        'l-accent':    '#e85520',
        'l-teal':      '#008866',
        'l-purple':    '#7c3aed',
        'l-yellow':    '#d97706',

        // ── Risk colors (same both modes) ─────────────────────────
        'risk-low':      '#00d4aa',
        'risk-medium':   '#f59e0b',
        'risk-high':     '#ff6b35',
        'risk-critical': '#ff2244',
      },
      fontFamily: {
        mono: ['JetBrains Mono', 'Fira Code', 'Consolas', 'monospace'],
        sans: ['Inter', 'system-ui', 'sans-serif'],
      },
      boxShadow: {
        'panel': '0 0 0 1px rgba(255,107,53,0.15), 0 4px 24px rgba(0,0,0,0.4)',
        'panel-l': '0 0 0 1px rgba(200,100,50,0.2), 0 4px 16px rgba(0,0,0,0.1)',
      },
    },
  },
  plugins: [],
}
