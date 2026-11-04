import { encode } from 'uqr';

/**
 * A QR code, drawn as an SVG on the server.
 *
 * No external QR service, per the brief. The value is only ever used to work
 * out which squares are filled in, never written into the markup, so there is
 * nothing here that user text could escape into.
 *
 * Deliberately not themed. QR codes need real black on real white to scan
 * reliably under a hotel's lighting, so these two colours stay fixed even
 * when the rest of the portal is in dark mode.
 */
export function QrCode({
  value,
  label,
  className,
  /** How much white space around the code, in modules. Four is the standard. */
  border = 2,
  ecc = 'M',
}: {
  value: string;
  label: string;
  className?: string;
  border?: number;
  ecc?: 'L' | 'M' | 'Q' | 'H';
}) {
  const result = encode(value, { ecc, border });
  const size = result.size;

  // One path for the whole code: far fewer nodes than a rect per module.
  let path = '';
  for (let y = 0; y < size; y += 1) {
    const row = result.data[y];
    if (!row) continue;
    for (let x = 0; x < size; x += 1) {
      if (row[x]) path += `M${x},${y}h1v1h-1z`;
    }
  }

  return (
    <svg
      viewBox={`0 0 ${size} ${size}`}
      className={className}
      role="img"
      aria-label={label}
      shapeRendering="crispEdges"
    >
      <rect width={size} height={size} fill="#FFFFFF" />
      <path d={path} fill="#000000" />
    </svg>
  );
}
