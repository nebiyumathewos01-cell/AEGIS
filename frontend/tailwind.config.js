/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        // SOC dark-mode palette
        'cyber-bg':       '#0d1117',
        'cyber-surface':  '#161b22',
        'cyber-border':   '#30363d',
        'cyber-muted':    '#8b949e',
        'cyber-text':     '#e6edf3',
        'cyber-accent':   '#58a6ff',
        'risk-low':       '#3fb950',
        'risk-medium':    '#d29922',
        'risk-high':      '#f85149',
        'risk-critical':  '#ff0000',
      },
      fontFamily: {
        mono: ['JetBrains Mono', 'Fira Code', 'Consolas', 'monospace'],
      },
    },
  },
  plugins: [],
}
