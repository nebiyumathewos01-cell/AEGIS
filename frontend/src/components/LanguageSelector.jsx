const LANGUAGES = [
  { code: 'en', label: 'English',      flag: '🇬🇧' },
  { code: 'am', label: 'አማርኛ',        flag: '🇪🇹' },
  { code: 'om', label: 'Afaan Oromoo', flag: '🇪🇹' },
]

export default function LanguageSelector({ value, onChange, className = '' }) {
  return (
    <div className={`flex items-center gap-2 ${className}`}>
      <span className="text-xs font-semibold uppercase tracking-wide"
        style={{ color: 'var(--muted)' }}>
        Language
      </span>
      <div className="flex gap-1">
        {LANGUAGES.map(lang => (
          <button
            key={lang.code}
            onClick={() => onChange(lang.code)}
            className="flex items-center gap-1.5 px-2.5 py-1 rounded text-xs font-medium transition-all"
            style={value === lang.code ? {
              background: 'rgba(255,107,53,0.12)',
              color: 'var(--accent)',
              border: '1px solid rgba(255,107,53,0.3)',
            } : {
              background: 'var(--surface2)',
              color: 'var(--muted)',
              border: '1px solid var(--border)',
            }}
          >
            <span>{lang.flag}</span>
            <span>{lang.label}</span>
          </button>
        ))}
      </div>
    </div>
  )
}
