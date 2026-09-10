export default function Spinner({ size = 'md', className = '' }) {
  const sz = size === 'sm' ? 'w-4 h-4' : size === 'lg' ? 'w-8 h-8' : 'w-6 h-6'
  return (
    <div className={`${sz} border-2 border-cyber-border border-t-cyber-accent rounded-full animate-spin ${className}`} />
  )
}

