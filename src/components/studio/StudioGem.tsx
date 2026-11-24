/**
 * A glass hexagon prism, drawn in SVG: the one object on the Studio home
 * page, in the spirit of a product render. Decorative only, and it floats
 * gently only where motion is welcome.
 */
export function StudioGem({ className = '' }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 240 260"
      aria-hidden="true"
      className={`studio-gem ${className}`}
      focusable="false"
    >
      <defs>
        <linearGradient id="gem-top" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#d9fbff" />
          <stop offset="1" stopColor="#6fe3f2" />
        </linearGradient>
        <linearGradient id="gem-left" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#3cc9df" />
          <stop offset="1" stopColor="#0b6f86" />
        </linearGradient>
        <linearGradient id="gem-right" x1="1" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#1aa7c4" />
          <stop offset="1" stopColor="#063d52" />
        </linearGradient>
        <linearGradient id="gem-shine" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#ffffff" stopOpacity=".85" />
          <stop offset="1" stopColor="#ffffff" stopOpacity="0" />
        </linearGradient>
      </defs>
      {/* Shadow on the floor. */}
      <ellipse cx="120" cy="246" rx="70" ry="9" fill="#000" opacity=".28" />
      {/* Sides of the prism. */}
      <polygon points="40,84 120,130 120,226 40,180" fill="url(#gem-left)" opacity=".92" />
      <polygon points="200,84 120,130 120,226 200,180" fill="url(#gem-right)" opacity=".92" />
      {/* The hexagon top. */}
      <polygon points="120,38 200,84 120,130 40,84" fill="url(#gem-top)" />
      <polygon
        points="120,52 176,84 120,116 64,84"
        fill="none"
        stroke="#ffffff"
        strokeOpacity=".55"
        strokeWidth="2"
      />
      {/* Edges and a highlight, for the glass. */}
      <polyline
        points="40,84 120,130 200,84"
        fill="none"
        stroke="#e9feff"
        strokeOpacity=".7"
        strokeWidth="1.5"
      />
      <line
        x1="120"
        y1="130"
        x2="120"
        y2="226"
        stroke="#e9feff"
        strokeOpacity=".5"
        strokeWidth="1.5"
      />
      <polygon points="52,94 70,104 70,170 52,160" fill="url(#gem-shine)" opacity=".45" />
      <rect x="126" y="150" width="34" height="14" rx="1" fill="#04131a" opacity=".85" />
      <text
        x="143"
        y="160"
        textAnchor="middle"
        fontSize="8"
        fontFamily="ui-monospace, monospace"
        fill="#9ff2ff"
      >
        PS-27
      </text>
    </svg>
  );
}
