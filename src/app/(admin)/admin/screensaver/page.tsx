import type { Metadata } from 'next';

import { getData } from '@/data';
import { requireAdmin } from '@/lib/admin-guard';
import { PhotoField } from '@/modules/loop/components/PhotoField';
import { removeLead, saveLead, saveLoopText } from '@/modules/loop/actions';
import { LOOP_KEY, LOOP_PHOTO_PREFIX, parseLoop, riddlesToText } from '@/modules/loop/logic';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = { title: 'Screensaver' };

const BOX =
  'mt-1 block w-full rounded-lg border border-line bg-canvas px-3 py-2 font-normal text-ink';

/**
 * What the big screen plays while nothing else is on: riddles that reveal
 * their answer, "Do you know?" facts, and the new leads and heads. Pick
 * "Screensaver" on the Big screen page to put it on the projector.
 */
export default async function ScreensaverPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  await requireAdmin('/admin/screensaver');
  const params = await searchParams;
  const data = getData();
  const content = parseLoop(await data.settings.get(LOOP_KEY));
  const withPhoto = new Set<string>();
  for (const lead of content.leads) {
    if (await data.settings.get(`${LOOP_PHOTO_PREFIX}${lead.id}`)) withPhoto.add(lead.id);
  }
  const saved = typeof params.saved === 'string' ? params.saved : '';

  return (
    <div className="max-w-4xl space-y-6">
      <header>
        <h1 className="text-2xl font-bold text-ink">Screensaver</h1>
        <p className="mt-1 text-ink-soft">
          What the projector plays during breaks: riddles (the answer appears after a pause), “Do
          you know?” facts, and a welcome to the new leads and heads. They take turns. To show it,
          choose Screensaver on the Big screen page.
        </p>
      </header>

      {saved ? (
        <p
          role="status"
          className="rounded-lg border border-success p-3 font-semibold text-success"
        >
          {saved === 'name'
            ? 'Give the person a name first.'
            : 'Saved. The screen updates within seconds.'}
        </p>
      ) : null}

      <form
        action={saveLoopText}
        className="space-y-4 rounded-xl border border-line bg-surface p-4"
      >
        <label className="block text-sm font-semibold text-ink">
          Teka-teki (riddles): one per line, the question, then a | and the answer
          <textarea
            name="riddles"
            rows={6}
            defaultValue={riddlesToText(content.riddles)}
            placeholder="Apa yang makin diambil, makin besar? | Lubang"
            className={BOX}
          />
        </label>
        <label className="block text-sm font-semibold text-ink">
          Do you know? One fact per line
          <textarea
            name="facts"
            rows={6}
            defaultValue={content.facts.join('\n')}
            placeholder="Write a short fact, one per line."
            className={BOX}
          />
        </label>
        <button
          type="submit"
          className="min-h-11 rounded-lg bg-primary px-5 font-bold text-on-primary"
        >
          Save riddles and facts
        </button>
      </form>

      <section id="leads" className="space-y-3 rounded-xl border border-line bg-surface p-4">
        <h2 className="text-lg font-bold text-ink">New leads and heads</h2>
        <p className="text-sm text-ink-soft">
          Name, role and a photo (it can be an illustrated or styled picture). Each gets a card on
          the screen.
        </p>
        {content.leads.length > 0 ? (
          <ul className="space-y-3">
            {content.leads.map((lead) => (
              <li key={lead.id} className="rounded-lg border border-line bg-canvas p-3">
                <form
                  action={saveLead}
                  className="grid gap-3 sm:grid-cols-[auto_1fr_1fr] sm:items-end"
                >
                  <input type="hidden" name="id" value={lead.id} />
                  {withPhoto.has(lead.id) ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={`/api/loop/photo/${lead.id}`}
                      alt={`${lead.name}`}
                      className="size-20 rounded-lg object-cover"
                    />
                  ) : (
                    <span className="grid size-20 place-items-center rounded-lg bg-muted text-xs text-ink-soft">
                      No photo
                    </span>
                  )}
                  <label className="block text-sm font-semibold text-ink">
                    Name
                    <input name="name" required defaultValue={lead.name} className={BOX} />
                  </label>
                  <label className="block text-sm font-semibold text-ink">
                    Role
                    <input name="role" defaultValue={lead.role} className={BOX} />
                  </label>
                  <div className="sm:col-span-3">
                    <PhotoField label="Change the photo (optional)" />
                  </div>
                  <div className="flex gap-2 sm:col-span-3">
                    <button
                      type="submit"
                      className="min-h-10 rounded-lg bg-primary px-4 font-bold text-on-primary"
                    >
                      Save
                    </button>
                  </div>
                </form>
                <form action={removeLead} className="mt-2">
                  <input type="hidden" name="id" value={lead.id} />
                  <button
                    type="submit"
                    className="min-h-10 rounded-lg border border-line px-4 text-sm font-semibold text-ink"
                  >
                    Remove {lead.name}
                  </button>
                </form>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-ink-soft">Nobody added yet.</p>
        )}

        <form
          action={saveLead}
          className="grid gap-3 rounded-lg border border-dashed border-line p-3 sm:grid-cols-2"
        >
          <h3 className="font-bold text-ink sm:col-span-2">Add a lead</h3>
          <label className="block text-sm font-semibold text-ink">
            Name
            <input name="name" required className={BOX} />
          </label>
          <label className="block text-sm font-semibold text-ink">
            Role
            <input name="role" className={BOX} />
          </label>
          <div className="sm:col-span-2">
            <PhotoField />
          </div>
          <button
            type="submit"
            className="min-h-11 rounded-lg bg-primary px-5 font-bold text-on-primary sm:col-span-2 sm:w-fit"
          >
            Add to the screensaver
          </button>
        </form>
      </section>
    </div>
  );
}
