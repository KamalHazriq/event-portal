'use client';

/**
 * The last resort, when even the main layout fails. It replaces the whole
 * page, so it brings its own html and body and plain styles.
 */
export default function GlobalError({ reset }: { error: Error; reset: () => void }) {
  return (
    <html lang="en">
      <body
        style={{
          margin: 0,
          background: '#05090c',
          color: '#e8f0f2',
          fontFamily: 'system-ui, sans-serif',
        }}
      >
        <main id="main" style={{ maxWidth: 560, margin: '15vh auto', padding: 24 }}>
          <h1 style={{ fontSize: 28 }}>Something went wrong</h1>
          <p style={{ color: '#a9bcc2' }}>
            The portal did not load. It is usually a passing connection problem.
          </p>
          <button
            type="button"
            onClick={reset}
            style={{
              minHeight: 44,
              padding: '0 20px',
              borderRadius: 8,
              border: 0,
              background: '#0f6bf5',
              color: '#fff',
              fontWeight: 700,
              fontSize: 16,
            }}
          >
            Try again
          </button>
        </main>
      </body>
    </html>
  );
}
