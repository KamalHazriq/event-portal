'use client';

/** Opens the browser's print dialog, where "Save as PDF" makes the PDF. */
export function PrintButton({ label = 'Print or save as PDF' }: { label?: string }) {
  return (
    <button
      type="button"
      onClick={() => window.print()}
      className="min-h-11 rounded-lg bg-primary px-4 font-bold text-on-primary"
    >
      {label}
    </button>
  );
}
