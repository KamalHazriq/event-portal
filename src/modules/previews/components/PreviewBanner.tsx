/**
 * Sits at the top of every preview page so nobody mistakes dummy data for
 * the real thing, especially on a phone at a busy desk.
 */
export function PreviewBanner({
  module,
  children,
}: {
  module: string;
  children?: React.ReactNode;
}) {
  return (
    <div
      role="note"
      className="rounded-lg border-2 border-dashed border-warning bg-warning/10 p-3 text-sm"
    >
      <p className="font-bold text-ink">Preview with dummy data. Nothing on this page is saved.</p>
      <p className="mt-0.5 text-ink-soft">
        {module}. Buttons work in this tab only, so you can try the flow and comment on it.
      </p>
      {children ? <div className="mt-1 text-ink-soft">{children}</div> : null}
    </div>
  );
}

/** A small "Preview" tag for lists and the dashboard. */
export function PreviewTag() {
  return (
    <span className="ml-2 rounded border border-warning px-1.5 py-0.5 align-middle text-xs font-bold uppercase tracking-wide text-warning">
      Preview
    </span>
  );
}
