/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        // ── Dark mode (Deep Obsidian SOC) ─────────────────────────
        'd-bg':        '#090a0f',   // deepest background (obsidian slate)
        'd-surface':   '#12141a',   // panel background
        'd-surface2':  '#181b24',   // elevated panels
        'd-border':    '#222632',   // borders
        'd-border2':   '#2d3343',   // hover borders
        'd-text':      '#f0f3f8',   // primary text
        'd-muted':     '#838e9e',   // secondary text
        'd-accent':    '#00e599',   // vibrant SOC Emerald
        'd-teal':      '#00d4aa',   // cyber teal
        'd-purple':    '#8b5cf6',   // purple accent
        'd-yellow':    '#f59e0b',   // warning

        // ── Light mode ────────────────────────────────────────────
        'l-bg':        '#f8fafc',
        'l-surface':   '#ffffff',
        'l-surface2':  '#f1f5f9',
        'l-border':    '#e2e8f0',
        'l-border2':   '#cbd5e1',
        'l-text':      '#0f172a',
        'l-muted':     '#64748b',
        'l-accent':    '#059669',
        'l-teal':      '#0d9488',
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
