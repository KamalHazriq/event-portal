import type { ConfigError } from '@/lib/config';

/**
 * Shown instead of the portal when config/event.json is wrong.
 *
 * Deliberately plain: no theme tokens, because the theme lives in the file
 * that failed to load. Inline styles only, so this renders even if the CSS
 * never arrives.
 */
export function ConfigErrorScreen({ error }: { error: ConfigError }) {
  return (
    <div
      style={{
        fontFamily: 'Arial, Helvetica, sans-serif',
        maxWidth: '44rem',
        margin: '0 auto',
        padding: '2rem 1rem',
        lineHeight: 1.55,
        color: '#0B1B33',
      }}
    >
      <h1 style={{ fontSize: '1.5rem', marginBottom: '0.5rem' }}>
        The event configuration needs fixing
      </h1>
      <p style={{ marginTop: 0 }}>
        The portal will not start until the problems below are sorted out. Nothing is broken in the
        code, only in the config file.
      </p>

      <p style={{ marginBottom: '0.25rem' }}>
        <strong>File:</strong> <code>{error.filePath}</code>
      </p>

      <ul
        style={{
          background: '#FDECEC',
          border: '1px solid #E5A5A5',
          padding: '1rem 1rem 1rem 2rem',
          borderRadius: '6px',
        }}
      >
        {error.problems.map((problem) => (
          <li key={problem} style={{ marginBottom: '0.35rem' }}>
            {problem}
          </li>
        ))}
      </ul>

      <h2 style={{ fontSize: '1.1rem', marginTop: '1.5rem' }}>How to fix it</h2>
      <ol style={{ paddingLeft: '1.5rem' }}>
        <li>Open the file above in a text editor.</li>
        <li>Each line in red names the field and what is wrong with it.</li>
        <li>Save the file. This page reloads on its own with the fix applied.</li>
      </ol>
      <p>
        The rules live in <code>src/lib/event-schema.ts</code> if you want to see what is allowed.
      </p>
    </div>
  );
}
