import type { Metadata } from 'next';
import Link from 'next/link';

import { requireAdmin } from '@/lib/admin-guard';
import { getEventConfig } from '@/lib/config';
import { overlayRaw, parseOverlay } from '@/lib/config-overlay';
import { refreshConfigOverlay } from '@/lib/config-sync';
import {
  resetContent,
  saveDepartments,
  saveEventDetails,
  saveInfo,
  saveResources,
} from '@/modules/content/actions';
import { FormPending } from '@/components/FormPending';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = { title: 'Event info' };

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

const TABS = [
  ['details', 'Event details'],
  ['info', 'Know before you go'],
  ['resources', 'Resources'],
  ['departments', 'Departments'],
] as const;

const first = (v: string | string[] | undefined) => (typeof v === 'string' ? v : '');

const input =
  'mt-1 block min-h-11 w-full rounded-lg border border-line bg-canvas px-3 py-2 text-ink';
const label = 'block text-sm font-semibold text-ink';
const primaryButton =
  'min-h-11 rounded-lg bg-primary px-5 font-bold text-on-primary hover:opacity-90';
const card = 'rounded-xl border border-line bg-surface p-4 sm:p-5';

function Section({
  id,
  title,
  hint,
  children,
}: {
  id: string;
  title: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <section id={id} aria-labelledby={`h-${id}`} className="scroll-mt-24">
      <h2 id={`h-${id}`} className="text-xl font-bold text-ink">
        {title}
      </h2>
      {hint ? <p className="mt-1 text-ink-soft">{hint}</p> : null}
      <div className="mt-3">{children}</div>
    </section>
  );
}

export default async function EventInfoEditorPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  await requireAdmin('/admin/event-info');
  await refreshConfigOverlay(true);
  const params = await searchParams;
  const config = getEventConfig();
  const edited = Object.keys(parseOverlay(overlayRaw())).length > 0;
  const { event, branding, info, resources, departments } = config;
  const slido = config.integrations.slido;
  const wanted = first(params.tab);
  const tab = TABS.some(([id]) => id === wanted) ? wanted : 'details';

  return (
    <div className="space-y-10">
      <header>
        <h1 className="text-2xl font-bold text-ink">Event info</h1>
        <p className="mt-1 text-ink-soft">
          The event details, the Know before you go page, the resource links and the department
          short names. Changes show on phones and the big screen within a few seconds. The agenda
          and speakers are on the Agenda page.
        </p>
      </header>

      {params.saved ? (
        <p
          role="status"
          className="rounded-lg border border-success bg-success/10 p-3 font-semibold text-ink"
        >
          Saved. It is live now.
        </p>
      ) : null}
      {params.reset ? (
        <p
          role="status"
          className="rounded-lg border border-success bg-success/10 p-3 font-semibold text-ink"
        >
          Reset. Everything is back to the event file.
        </p>
      ) : null}
      {params.error ? (
        <div role="alert" className="rounded-lg border-2 border-warning bg-warning/10 p-3 text-ink">
          <p className="font-bold">That was not saved.</p>
          <ul className="mt-1 list-disc pl-5">
            {first(params.error)
              .split(' | ')
              .map((line) => (
                <li key={line}>{line}</li>
              ))}
          </ul>
        </div>
      ) : null}

      <nav aria-label="Parts of the event info" className="flex flex-wrap gap-2">
        {TABS.map(([id, text]) => (
          <Link
            key={id}
            href={`/admin/event-info?tab=${id}`}
            aria-current={tab === id ? 'page' : undefined}
            className={`rounded-full border px-4 py-2 text-sm font-semibold no-underline transition-colors ${
              tab === id
                ? 'border-primary bg-primary text-on-primary'
                : 'border-line bg-surface text-ink hover:border-primary'
            }`}
          >
            {text}
          </Link>
        ))}
      </nav>

      {tab === 'details' ? (
        <>
          <Section
            id="details"
            title="Event details"
            hint="Shown in the page header, the footer, the big screen welcome and the browser tab."
          >
            <form action={saveEventDetails} className={`${card} space-y-3`}>
              <FormPending label="Saving" />
              <label className={label}>
                Event name
                <input
                  name="name"
                  required
                  maxLength={160}
                  defaultValue={event.name}
                  className={input}
                />
              </label>
              <label className={label}>
                Short name
                <input
                  name="shortName"
                  required
                  maxLength={60}
                  defaultValue={event.shortName}
                  className={input}
                />
              </label>
              <label className={label}>
                Tagline
                <input
                  name="tagline"
                  maxLength={200}
                  defaultValue={event.tagline}
                  className={input}
                />
              </label>
              <div className="grid gap-3 sm:grid-cols-2">
                <label className={label}>
                  Venue
                  <input
                    name="venue"
                    required
                    maxLength={200}
                    defaultValue={event.venue}
                    className={input}
                  />
                </label>
                <label className={label}>
                  City
                  <input name="city" maxLength={120} defaultValue={event.city} className={input} />
                </label>
              </div>
              <label className={label}>
                Help line (under the footer)
                <input
                  name="helpText"
                  maxLength={300}
                  defaultValue={event.helpText}
                  className={input}
                />
              </label>
              <label className={label}>
                Footer credit
                <input
                  name="footerText"
                  maxLength={200}
                  defaultValue={branding.footerText}
                  className={input}
                />
              </label>
              <div className="grid gap-3 sm:grid-cols-2">
                <label className={label}>
                  Slido link
                  <input
                    name="slidoUrl"
                    type="url"
                    maxLength={300}
                    defaultValue={slido?.eventUrl ?? ''}
                    className={input}
                  />
                </label>
                <label className={label}>
                  Slido code
                  <input
                    name="slidoCode"
                    maxLength={40}
                    defaultValue={slido?.eventCode ?? ''}
                    className={input}
                  />
                </label>
              </div>
              <button type="submit" className={primaryButton}>
                Save the event details
              </button>
            </form>
          </Section>
        </>
      ) : null}

      {tab === 'info' ? (
        <>
          <Section
            id="info"
            title="Know before you go"
            hint="A line with nothing after its label reads “Coming soon” for attendees. Tick Remove to take a line off."
          >
            <form action={saveInfo} className="space-y-4">
              <FormPending label="Saving" />
              <div className={`${card} space-y-3`}>
                <label className={label}>
                  Page title
                  <input
                    name="title"
                    maxLength={80}
                    defaultValue={info?.title ?? 'Know before you go'}
                    className={input}
                  />
                </label>
                <label className={label}>
                  Opening line
                  <textarea
                    name="intro"
                    rows={2}
                    maxLength={600}
                    defaultValue={info?.intro ?? ''}
                    className={input}
                  />
                </label>
              </div>

              {(info?.sections ?? []).map((section, i) => (
                <fieldset key={section.id} className={`${card} space-y-3`}>
                  <legend className="px-1 text-lg font-bold text-ink">{section.heading}</legend>
                  <input type="hidden" name={`s${i}.id`} value={section.id} />
                  <label className={label}>
                    Heading
                    <input
                      name={`s${i}.heading`}
                      maxLength={100}
                      defaultValue={section.heading}
                      className={input}
                    />
                  </label>
                  <label className={label}>
                    Text under the heading
                    <textarea
                      name={`s${i}.body`}
                      rows={2}
                      maxLength={2000}
                      defaultValue={section.body}
                      className={input}
                    />
                  </label>
                  {[...section.items, { label: '', text: '' }, { label: '', text: '' }].map(
                    (item, j) => (
                      <div
                        key={j}
                        className="grid gap-2 rounded-lg border border-line p-3 sm:grid-cols-[10rem_1fr_auto] sm:items-end"
                      >
                        <label className={label}>
                          {j < section.items.length ? 'Label' : 'New label'}
                          <input
                            name={`s${i}.i${j}.label`}
                            maxLength={80}
                            defaultValue={item.label}
                            className={input}
                          />
                        </label>
                        <label className={label}>
                          {j < section.items.length ? 'Text' : 'New text'}
                          <input
                            name={`s${i}.i${j}.text`}
                            maxLength={400}
                            defaultValue={item.text}
                            className={input}
                          />
                        </label>
                        {j < section.items.length ? (
                          <label className="flex min-h-11 items-center gap-2 text-sm text-ink">
                            <input type="checkbox" name={`s${i}.i${j}.remove`} className="size-5" />
                            Remove
                          </label>
                        ) : null}
                      </div>
                    ),
                  )}
                  <label className="flex min-h-11 items-center gap-3 text-ink">
                    <input type="checkbox" name={`s${i}.remove`} className="size-5" />
                    Remove this whole section
                  </label>
                </fieldset>
              ))}

              <fieldset className={`${card} space-y-3`}>
                <legend className="px-1 text-lg font-bold text-ink">Add a section</legend>
                <label className={label}>
                  New section heading
                  <input name="new.heading" maxLength={100} className={input} />
                </label>
                <label className={label}>
                  Text under it (optional)
                  <textarea name="new.body" rows={2} maxLength={2000} className={input} />
                </label>
                {[0, 1].map((j) => (
                  <div key={j} className="grid gap-2 sm:grid-cols-[10rem_1fr]">
                    <label className={label}>
                      Label
                      <input name={`new.i${j}.label`} maxLength={80} className={input} />
                    </label>
                    <label className={label}>
                      Text
                      <input name={`new.i${j}.text`} maxLength={400} className={input} />
                    </label>
                  </div>
                ))}
              </fieldset>

              <button type="submit" className={primaryButton}>
                Save the info page
              </button>
            </form>
          </Section>
        </>
      ) : null}

      {tab === 'resources' ? (
        <>
          <Section
            id="resources"
            title="Resources"
            hint="Slides, guides and photos for the Take aways page. A link not filled in yet reads “Coming soon”."
          >
            <form action={saveResources} className="space-y-3">
              <FormPending label="Saving" />
              {[
                ...resources.map((r, j) => ({ ...r, key: `r${j}`, isNew: false })),
                ...[0, 1, 2].map((j) => ({
                  id: '',
                  title: '',
                  url: '',
                  description: '',
                  kind: 'link' as const,
                  files: [] as { title: string; url: string }[],
                  key: `n${j}`,
                  isNew: true,
                })),
              ].map((r) => (
                <fieldset key={r.key} className={`${card} space-y-3`}>
                  <legend className="px-1 font-bold text-ink">
                    {r.isNew ? 'Add a resource' : r.title}
                  </legend>
                  {r.isNew ? null : <input type="hidden" name={`${r.key}.id`} value={r.id} />}
                  <div className="grid gap-3 sm:grid-cols-2">
                    <label className={label}>
                      Title
                      <input
                        name={`${r.key}.title`}
                        maxLength={160}
                        defaultValue={r.title}
                        className={input}
                      />
                    </label>
                    <label className={label}>
                      Link (https://… or /file inside the portal)
                      <input
                        name={`${r.key}.url`}
                        maxLength={600}
                        defaultValue={r.url}
                        className={input}
                      />
                    </label>
                  </div>
                  <label className={label}>
                    Files one by one (optional): Title | link, one per line
                    <textarea
                      name={`${r.key}.files`}
                      rows={Math.min(8, Math.max(3, r.files.length + 1))}
                      defaultValue={r.files.map((f) => `${f.title} | ${f.url}`).join('\n')}
                      placeholder={'Opening remarks | https://…\nKeynote | https://…'}
                      className={`${input} font-mono text-sm`}
                    />
                    <span className="mt-1 block text-xs font-normal text-ink-soft">
                      The main link above is then &ldquo;everything in one go&rdquo;, a folder or a
                      zip. These are the files one at a time. Put the link after the last |.
                    </span>
                  </label>
                  <label className={label}>
                    Description
                    <input
                      name={`${r.key}.description`}
                      maxLength={400}
                      defaultValue={r.description}
                      className={input}
                    />
                  </label>
                  <div className="flex flex-wrap items-center gap-4">
                    <label className={label}>
                      Type
                      <select name={`${r.key}.kind`} defaultValue={r.kind} className={input}>
                        <option value="link">Link</option>
                        <option value="file">File to download</option>
                      </select>
                    </label>
                    {r.isNew ? null : (
                      <label className="flex min-h-11 items-center gap-2 text-sm text-ink">
                        <input type="checkbox" name={`${r.key}.remove`} className="size-5" />
                        Remove
                      </label>
                    )}
                  </div>
                </fieldset>
              ))}
              <button type="submit" className={primaryButton}>
                Save the resources
              </button>
            </form>
          </Section>
        </>
      ) : null}

      {tab === 'departments' ? (
        <>
          <Section
            id="departments"
            title="Department short names"
            hint="One per line, like Corporate & Engineering Services = CORES. Add (division) after the short name of the division over the departments (D&I): it is left out of the department count and leaderboard. Used on the big screen, phones, name tags and reports."
          >
            <form action={saveDepartments} className={`${card} space-y-3`}>
              <FormPending label="Saving" />
              <label className={label}>
                Departments
                <textarea
                  name="departments"
                  rows={Math.min(20, Math.max(5, departments.length + 2))}
                  defaultValue={departments
                    .map((d) => `${d.name} = ${d.short}${d.division ? ' (division)' : ''}`)
                    .join('\n')}
                  className={`${input} font-mono text-sm`}
                />
              </label>
              <button type="submit" className={primaryButton}>
                Save the department names
              </button>
            </form>
          </Section>
        </>
      ) : null}

      <Section
        id="reset"
        title="Reset"
        hint="Drops every change made on the Agenda and Event info pages, so the event file shows again."
      >
        <form action={resetContent} className={`${card} space-y-3`}>
          <FormPending label="Resetting" />
          <p className="text-ink">
            {edited
              ? 'There are saved changes on top of the event file.'
              : 'Nothing has been changed yet: this is the event file as it is.'}
          </p>
          <label className="flex min-h-11 items-center gap-3 text-ink">
            <input type="checkbox" name="confirm" value="yes" className="size-5" />
            Yes, throw away all my changes
          </label>
          <button
            type="submit"
            className="min-h-11 rounded-lg border border-line px-5 font-semibold text-ink"
          >
            Reset everything
          </button>
        </form>
      </Section>
    </div>
  );
}
