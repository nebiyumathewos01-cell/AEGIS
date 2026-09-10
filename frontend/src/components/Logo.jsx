/**
 * AEGIS Logo component — uses the SVG logo file.
 * size: 'sm' | 'md' | 'lg' | 'xl'
 * variant: 'full' (icon + text) | 'icon' (icon only)
 */
export default function Logo({ size = 'md', variant = 'full', className = '' }) {
  const iconSizes = { sm: 28, md: 36, lg: 52, xl: 80 }
  const textSizes = { sm: 'text-base', md: 'text-lg', lg: 'text-2xl', xl: 'text-4xl' }
  const subSizes  = { sm: 'text-[8px]', md: 'text-[9px]', lg: 'text-[11px]', xl: 'text-xs' }
  const px = iconSizes[size] ?? 36

  if (variant === 'icon') {
    return (
      <img
        src="/logo.svg"
        alt="AEGIS Logo"
        width={px}
        height={px}
        className={className}
        draggable={false}
      />
    )
  }

  return (
    <div className={`flex items-center gap-3 ${className}`}>
      <img
        src="/logo.svg"
        alt="AEGIS"
        width={px}
        height={px}
        draggable={false}
        className="shrink-0"
      />
      <div>
        <p className={`font-black tracking-widest text-cyber-text leading-none ${textSizes[size]}`}>
          AEGIS
        </p>
        <p className={`font-mono text-cyber-muted leading-tight tracking-widest uppercase ${subSizes[size]}`}>
          Alert Evaluation &amp; Guided Investigation
        </p>
      </div>
    </div>
  )
}
