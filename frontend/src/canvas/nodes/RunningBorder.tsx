/** Animated marching-ants SVG border overlay for running nodes. */
export default function RunningBorder({ radius = 10, color = '#f0883e' }: { radius?: number; color?: string }) {
  return (
    <svg
      style={{
        position: 'absolute',
        inset: 0,
        width: '100%',
        height: '100%',
        pointerEvents: 'none',
        overflow: 'visible',
        borderRadius: radius,
      }}
    >
      <rect
        x="0" y="0"
        width="100%" height="100%"
        rx={radius} ry={radius}
        fill="none"
        stroke={color}
        strokeWidth="1.5"
        strokeDasharray="8 5"
        style={{ animation: 'march 0.4s linear infinite' }}
      />
    </svg>
  )
}
