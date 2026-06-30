// TeamLogo renders a team logo image when a URL is available, falling back to
// the first-letter gradient avatar for teams without a real logo (or while the
// logo URL is still loading from the backend).
type Props = {
  src?: string
  name: string
  size: number
  radius?: string
  fallbackBg?: string
  style?: React.CSSProperties
}

export default function TeamLogo({ src, name, size, radius = '50%', fallbackBg, style }: Props) {
  if (src) {
    return (
      <img
        src={src}
        alt={name}
        loading="lazy"
        style={{
          width: size,
          height: size,
          objectFit: 'contain',
          borderRadius: radius,
          flexShrink: 0,
          ...style,
        }}
      />
    )
  }
  return (
    <div
      style={{
        width: size,
        height: size,
        borderRadius: radius,
        background: fallbackBg ?? 'linear-gradient(135deg, var(--accent-red), var(--accent-orange))',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontSize: size * 0.45,
        color: '#fff',
        fontWeight: 700,
        fontFamily: 'var(--font-display)',
        flexShrink: 0,
        ...style,
      }}
    >
      {name ? name.charAt(0).toUpperCase() : '?'}
    </div>
  )
}
