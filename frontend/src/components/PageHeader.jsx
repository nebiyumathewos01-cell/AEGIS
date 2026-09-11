export default function PageHeader({ title, subtitle, actions }) {
  return (
    <div className="flex items-start justify-between pb-4 mb-1"
      style={{ borderBottom: '1px solid var(--border)' }}>
      <div>
        <div className="flex items-center gap-2 mb-0.5">
          <div className="w-0.5 h-5 rounded" style={{ background: 'var(--accent)' }} />
          <h1 className="text-lg font-bold" style={{ color: 'var(--text)' }}>{title}</h1>
        </div>
        {subtitle && (
          <p className="text-xs font-mono ml-2.5" style={{ color: 'var(--muted)' }}>{subtitle}</p>
        )}
      </div>
      {actions && <div className="flex items-center gap-2">{actions}</div>}
    </div>
  )
}
