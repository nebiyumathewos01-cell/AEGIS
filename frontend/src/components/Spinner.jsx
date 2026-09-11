export default function Spinner({ size = 'md', className = '' }) {
  const sz = size === 'sm' ? 'w-4 h-4' : size === 'lg' ? 'w-8 h-8' : 'w-6 h-6'
  return (
    <div className={`${sz} rounded-full animate-spin ${className}`}
      style={{ border: '2px solid var(--border)', borderTopColor: 'var(--accent)' }} />
  )
}
