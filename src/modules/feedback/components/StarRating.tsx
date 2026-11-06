/**
 * The 1 to 5 star question.
 *
 * Five radio buttons, styled to look like stars. No JavaScript: the browser
 * handles selection, and "required" makes the browser itself stop a
 * submission with no rating, so nobody loses a typed comment to a validation
 * round trip.
 *
 * The labels say "1 star" and so on rather than only showing a shape, so it
 * works with a screen reader and when a star does not render.
 */
const VALUES = [1, 2, 3, 4, 5] as const;

export function StarRating({
  legend,
  name = 'rating',
  defaultValue,
}: {
  legend: string;
  name?: string;
  defaultValue?: number;
}) {
  return (
    <fieldset className="border-0 p-0">
      <legend className="mb-2 block font-semibold text-ink">{legend}</legend>

      <div className="flex flex-wrap gap-2">
        {VALUES.map((value) => (
          <label
            key={value}
            className="group relative flex min-h-14 min-w-14 cursor-pointer flex-col items-center justify-center rounded-lg border border-line bg-surface px-3 py-2 text-ink has-[:checked]:border-primary has-[:checked]:bg-primary has-[:checked]:text-on-primary has-[:focus-visible]:outline has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-accent"
          >
            {/*
              The input covers the whole label rather than being hidden off
              screen, so the thing a thumb lands on is the control itself.
              It keeps its place in the accessibility tree, and the focus ring
              is drawn on the label around it.
            */}
            <input
              type="radio"
              name={name}
              value={value}
              required
              defaultChecked={defaultValue === value}
              className="absolute inset-0 m-0 cursor-pointer appearance-none opacity-0"
            />
            <span aria-hidden="true" className="pointer-events-none text-xl leading-none">
              {'★'}
            </span>
            <span className="pointer-events-none mt-0.5 text-sm font-bold leading-none">
              {value}
            </span>
            <span className="sr-only">
              {value} {value === 1 ? 'star' : 'stars'}
            </span>
          </label>
        ))}
      </div>

      <p className="mt-2 text-sm text-ink-soft">1 is poor, 5 is excellent.</p>
    </fieldset>
  );
}
