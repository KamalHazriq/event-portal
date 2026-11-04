'use client';

import { useRef, useState } from 'react';

/**
 * Saves the portal QR code as a PNG or an SVG, for dropping into a slide.
 *
 * The squares are worked out on the server and handed over as rows of 0s and
 * 1s, so no QR library is sent to the browser. The PNG is drawn on a canvas
 * here, which means no image library on the server either.
 */
export function QrDownload({
  rows,
  filename,
  label,
}: {
  rows: string[];
  filename: string;
  label: string;
}) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [saved, setSaved] = useState<string | null>(null);

  const size = rows.length;

  const download = (href: string, name: string) => {
    const link = document.createElement('a');
    link.href = href;
    link.download = name;
    document.body.appendChild(link);
    link.click();
    link.remove();
  };

  const savePng = (pixelsPerModule: number) => {
    const canvas = canvasRef.current;
    if (!canvas || size === 0) return;

    canvas.width = size * pixelsPerModule;
    canvas.height = size * pixelsPerModule;
    const context = canvas.getContext('2d');
    if (!context) return;

    // Real white and real black, so it scans off a projector screen.
    context.fillStyle = '#FFFFFF';
    context.fillRect(0, 0, canvas.width, canvas.height);
    context.fillStyle = '#000000';

    rows.forEach((row, y) => {
      for (let x = 0; x < row.length; x += 1) {
        if (row[x] === '1') {
          context.fillRect(
            x * pixelsPerModule,
            y * pixelsPerModule,
            pixelsPerModule,
            pixelsPerModule,
          );
        }
      }
    });

    canvas.toBlob((blob) => {
      if (!blob) return;
      const url = URL.createObjectURL(blob);
      download(url, `${filename}-${canvas.width}px.png`);
      window.setTimeout(() => URL.revokeObjectURL(url), 5000);
      setSaved(`Saved a ${canvas.width} by ${canvas.height} pixel PNG.`);
    }, 'image/png');
  };

  const saveSvg = () => {
    let path = '';
    rows.forEach((row, y) => {
      for (let x = 0; x < row.length; x += 1) {
        if (row[x] === '1') path += `M${x},${y}h1v1h-1z`;
      }
    });

    const svg = [
      `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${size} ${size}" shape-rendering="crispEdges">`,
      `<title>${label}</title>`,
      `<rect width="${size}" height="${size}" fill="#FFFFFF"/>`,
      `<path d="${path}" fill="#000000"/>`,
      '</svg>',
    ].join('');

    const url = URL.createObjectURL(new Blob([svg], { type: 'image/svg+xml' }));
    download(url, `${filename}.svg`);
    window.setTimeout(() => URL.revokeObjectURL(url), 5000);
    setSaved('Saved an SVG. It stays sharp at any size, and PowerPoint accepts it.');
  };

  return (
    <div>
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => savePng(20)}
          className="min-h-11 rounded-lg bg-primary px-4 py-2 font-bold text-on-primary"
        >
          Save PNG for a slide
        </button>
        <button
          type="button"
          onClick={() => savePng(40)}
          className="min-h-11 rounded-lg border border-line px-4 py-2 font-semibold text-ink"
        >
          Save large PNG for print
        </button>
        <button
          type="button"
          onClick={saveSvg}
          className="min-h-11 rounded-lg border border-line px-4 py-2 font-semibold text-ink"
        >
          Save SVG
        </button>
      </div>

      {saved ? (
        <p role="status" className="mt-2 text-sm text-ink-soft">
          {saved}
        </p>
      ) : null}

      <canvas ref={canvasRef} className="hidden" />
    </div>
  );
}
