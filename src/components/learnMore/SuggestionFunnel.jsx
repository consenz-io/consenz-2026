/**
 * A funnel of proposals: many ideas enter through the wide mouth, and only a
 * few focused proposals come out of the neck. Used to show that points keep a
 * document open to everyone while keeping it focused on what matters.
 */
const INCOMING = [
  { x: 52, y: 26, r: 4, opacity: 0.5 },
  { x: 96, y: 15, r: 3, opacity: 0.38 },
  { x: 140, y: 26, r: 5, opacity: 0.8 },
  { x: 184, y: 13, r: 3.5, opacity: 0.45 },
  { x: 226, y: 25, r: 4.5, opacity: 0.68 },
  { x: 270, y: 16, r: 3, opacity: 0.4 },
];

const INSIDE = [
  { y: 64, xs: [74, 108, 142, 176, 210, 244, 272], r: 3.2 },
  { y: 92, xs: [98, 130, 162, 196, 226], r: 3.6 },
  { y: 120, xs: [128, 161, 194], r: 4.2 },
  { y: 142, xs: [148, 174], r: 4.6 },
];

export default function SuggestionFunnel() {
  return (
    <div
      dir="ltr"
      className="relative mx-auto my-1.5 w-full max-w-[210px] select-none"
      aria-hidden="true"
    >
      <svg viewBox="0 0 320 232" className="w-full">
        <defs>
          <linearGradient id="funnel-fill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#eff6ff" />
            <stop offset="100%" stopColor="#bfdbfe" />
          </linearGradient>
        </defs>

        {/* ideas arriving from the community */}
        {INCOMING.map((dot, i) => (
          <circle
            key={`in-${i}`}
            cx={dot.x}
            cy={dot.y}
            r={dot.r}
            fill="#94a3b8"
            opacity={dot.opacity}
            className="funnel-drift"
            style={{ animationDelay: `${i * 0.22}s` }}
          />
        ))}

        {/* the funnel */}
        <path
          d="M16 44 L304 44 L184 150 L172 186 L148 186 L136 150 Z"
          fill="url(#funnel-fill)"
          stroke="#93c5fd"
          strokeWidth="2"
          strokeLinejoin="round"
        />

        {/* proposals inside — many at the mouth, few at the neck */}
        {INSIDE.map((row, rowIndex) =>
          row.xs.map((x, i) => (
            <circle
              key={`in-funnel-${rowIndex}-${i}`}
              cx={x}
              cy={row.y}
              r={row.r}
              fill="#2563eb"
              opacity={0.45 + rowIndex * 0.15}
              className="funnel-drift"
              style={{ animationDelay: `${0.35 + rowIndex * 0.3 + i * 0.08}s` }}
            />
          ))
        )}

        {/* focused proposals leaving the neck */}
        <rect
          x="112"
          y="196"
          width="96"
          height="22"
          rx="11"
          fill="#ecfdf5"
          stroke="#6ee7b7"
          strokeWidth="1.5"
        />
        <circle cx="141" cy="207" r="4.5" fill="#059669" />
        <circle cx="161" cy="207" r="4.5" fill="#059669" />
        <path
          d="M176 207 l3 3 l5 -6"
          fill="none"
          stroke="#059669"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    </div>
  );
}