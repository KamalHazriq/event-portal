import type { Metadata } from 'next';

import { requireAdmin } from '@/lib/admin-guard';
import { getEventConfig } from '@/lib/config';
import { overlayRaw, parseOverlay } from '@/lib/config-overlay';
import { refreshConfigOverlay } from '@/lib/config-sync';
import { sessionTypes } from '@/lib/event-schema';
import { formatLongDate, formatTimeRange } from '@/lib/time';
import {
  addSession,
  addSpeaker,
  deleteSession,
  deleteSpeaker,
  saveSession,
  saveSpeaker,
} from '@/modules/content/actions';
import { sessionTypeLabel } from '@/modules/schedule/logic';
import { FormPending } from '@/components/FormPending';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = { title: 'Agenda' };

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

const first = (v: string | string[] | undefined) => (typeof v === 'string' ? v : '');

const input =
  'mt-1 block min-h-11 w-full rounded-lg border border-line bg-canvas px-3 py-2 text-ink';
const label = 'block text-sm font-semibold text-ink';
const primaryButton =
  'min-h-11 rounded-lg bg-primary px-5 font-bold text-on-primary hover:opacity-90';
const quietButton = 'min-h-11 rounded-lg border border-line px-4 font-semibold text-ink';

function Badge({
  children,
  tone = 'plain',
}: {
  children: React.ReactNode;
  tone?: 'plain' | 'warn';
}) {
  return (
    <span
      className={`rounded-full px-2 py-0.5 text-xs font-bold ${
        tone === 'warn' ? 'bg-warning/20 text-ink' : 'bg-muted text-ink-soft'
      }`}
    >
      {children}
    </span>
  );
}

export default async function AgendaEditorPage({ searchParams }: { searchParams: SearchParams }) {
  await requireAdmin('/admin/agenda');
  await refreshConfigOverlay(true);
  const params = await searchParams;
  const config = getEventConfig();
  const overlay = parseOverlay(overlayRaw());
  const tz = config.event.timezone;

  const added = new Set((overlay.addedSessions ?? []).map((a) => a.session.id));
  const addedSpeakers = new Set((overlay.addedSpeakers ?? []).map((s) => s.id));
  const open = first(params.open);
  const openSpeaker = first(params.openSpeaker);
  const speakerUse = new Map<string, number>();
  for (const day of config.days) {
    for (const s of day.sessions) {
      for (const id of s.speakerIds) speakerUse.set(id, (speakerUse.get(id) ?? 0) + 1);
    }
  }

  return (
    <div className="space-y-8">
      <header>
        <h1 className="text-2xl font-bold text-ink">Agenda</h1>
        <p className="mt-1 text-ink-soft">
          Change a session&apos;s title, time, room or speakers, hide one, or add one. It shows on
          phones and the big screen within a few seconds. Times are 24 hour, like 14:30.
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

      <nav aria-label="Jump to" className="flex flex-wrap gap-2">
        {config.days.map((day) => (
          <a
            key={day.id}
            href={`#day-${day.id}`}
            className="rounded-full border border-line bg-surface px-4 py-2 text-sm font-semibold text-ink no-underline hover:border-primary"
          >
            {day.label}
          </a>
        ))}
        <a
          href="#speakers"
          className="rounded-full border border-line bg-surface px-4 py-2 text-sm font-semibold text-ink no-underline hover:border-primary"
        >
          Speakers
        </a>
      </nav>

      {config.days.map((day) => (
        <section
          key={day.id}
          id={`day-${day.id}`}
          aria-labelledby={`h-${day.id}`}
          className="scroll-mt-24"
        >
          <h2 id={`h-${day.id}`} className="text-xl font-bold text-ink">
            {day.label}
            <span className="ml-2 text-sm font-normal text-ink-soft">
              {formatLongDate(day.date, tz)}
            </span>
          </h2>

          <details
            id={`add-${day.id}`}
            className="mt-3 rounded-xl border border-dashed border-line bg-surface"
          >
            <summary className="cursor-pointer px-4 py-3 font-semibold text-ink">
              + Add a session to {day.label}
            </summary>
            <form action={addSession} className="space-y-3 border-t border-line p-4">
              <FormPending label="Adding the session" />
              <input type="hidden" name="dayId" value={day.id} />
              <label className={label}>
                Title
                <input name="title" required maxLength={160} className={input} />
              </label>
              <div className="grid grid-cols-2 gap-3">
                <label className={label}>
                  Starts
                  <input name="start" type="time" required className={input} />
                </label>
                <label className={label}>
                  Ends
                  <input name="end" type="time" required className={input} />
                </label>
              </div>
              <label className={label}>
                Room
                <input name="room" maxLength={120} className={input} />
              </label>
              <label className={label}>
                Type
                <select name="type" defaultValue="talk" className={input}>
                  {sessionTypes.map((t) => (
                    <option key={t} value={t}>
                      {sessionTypeLabel(t)}
                    </option>
                  ))}
                </select>
              </label>
              <label className={label}>
                About it (optional)
                <textarea name="description" rows={3} maxLength={1500} className={input} />
              </label>
              <label className="flex min-h-11 items-center gap-3 text-ink">
                <input type="checkbox" name="feedback" className="size-5" />
                Ask for feedback after it
              </label>
              <button type="submit" className={primaryButton}>
                Add session
              </button>
            </form>
          </details>

          <ul className="mt-3 space-y-2">
            {[...day.sessions]
              .sort((a, b) => a.start.localeCompare(b.start))
              .map((s) => {
                const edited = Boolean(overlay.sessions?.[s.id]);
                const isAdded = added.has(s.id);
                return (
                  <li key={s.id}>
                    <details
                      id={`s-${s.id}`}
                      open={open === s.id}
                      className={`rounded-xl border bg-surface ${s.hidden ? 'border-dashed border-line opacity-80' : 'border-line'}`}
                    >
                      <summary className="flex cursor-pointer flex-wrap items-center gap-x-3 gap-y-1 px-4 py-3">
                        <span className="font-mono text-sm font-semibold tabular-nums text-ink-soft">
                          {formatTimeRange(s.start, s.end)}
                        </span>
                        <span className="min-w-0 flex-1 font-semibold text-ink">{s.title}</span>
                        {s.hidden ? <Badge tone="warn">Hidden</Badge> : null}
                        {isAdded ? <Badge>Added</Badge> : edited ? <Badge>Edited</Badge> : null}
                      </summary>

                      <form action={saveSession} className="space-y-3 border-t border-line p-4">
                        <FormPending label="Saving" />
                        <input type="hidden" name="id" value={s.id} />
                        <label className={label}>
                          Title
                          <input
                            name="title"
                            required
                            maxLength={160}
                            defaultValue={s.title}
                            className={input}
                          />
                        </label>
                        <div className="grid grid-cols-2 gap-3">
                          <label className={label}>
                            Starts
                            <input
                              name="start"
                              type="time"
                              required
                              defaultValue={s.start}
                              className={input}
                            />
                          </label>
                          <label className={label}>
                            Ends
                            <input
                              name="end"
                              type="time"
                              required
                              defaultValue={s.end}
                              className={input}
                            />
                          </label>
                        </div>
                        <label className={label}>
                          Room
                          <input
                            name="room"
                            maxLength={120}
                            defaultValue={s.room}
                            className={input}
                          />
                        </label>
                        <label className={label}>
                          Type
                          <select name="type" defaultValue={s.type} className={input}>
                            {sessionTypes.map((t) => (
                              <option key={t} value={t}>
                                {sessionTypeLabel(t)}
                              </option>
                            ))}
                          </select>
                        </label>
                        <label className={label}>
                          About it
                          <textarea
                            name="description"
                            rows={3}
                            maxLength={1500}
                            defaultValue={s.description}
                            className={input}
                          />
                        </label>
                        <label className={label}>
                          Slides or handout link (optional)
                          <input
                            name="slidesUrl"
                            type="url"
                            maxLength={600}
                            defaultValue={s.slidesUrl ?? ''}
                            placeholder="https://… (a OneDrive link shared inside the company)"
                            className={input}
                          />
                          <span className="mt-1 block text-xs font-normal text-ink-soft">
                            Shows as &ldquo;Open the slides&rdquo; on the session page. Leave empty
                            to remove it.
                          </span>
                        </label>

                        <details className="group rounded-lg border border-line bg-canvas">
                          <summary className="flex min-h-11 cursor-pointer items-center gap-2 px-3 text-sm text-ink">
                            <span className="font-semibold">Speakers:</span>
                            <span className="min-w-0 flex-1 truncate text-ink-soft">
                              {s.speakerIds.length === 0
                                ? 'None, tap to choose'
                                : s.speakerIds
                                    .map((sid) => config.speakers.find((p) => p.id === sid)?.name)
                                    .filter(Boolean)
                                    .join(', ')}
                            </span>
                            <span
                              aria-hidden="true"
                              className="transition-transform group-open:rotate-180"
                            >
                              ▾
                            </span>
                          </summary>
                          <div className="grid max-h-64 gap-1 overflow-y-auto border-t border-line p-3 sm:grid-cols-2">
                            {config.speakers.map((p) => (
                              <label
                                key={p.id}
                                className="flex min-h-9 items-center gap-3 text-sm text-ink"
                              >
                                <input
                                  type="checkbox"
                                  name="speaker"
                                  value={p.id}
                                  defaultChecked={s.speakerIds.includes(p.id)}
                                  className="size-5"
                                />
                                <span>
                                  {p.name}
                                  {p.title ? (
                                    <span className="text-ink-soft">, {p.title}</span>
                                  ) : null}
                                </span>
                              </label>
                            ))}
                          </div>
                        </details>

                        <div className="space-y-1">
                          <label className="flex min-h-11 items-center gap-3 text-ink">
                            <input
                              type="checkbox"
                              name="show"
                              defaultChecked={!s.hidden}
                              className="size-5"
                            />
                            Show on the agenda
                          </label>
                          <label className="flex min-h-11 items-center gap-3 text-ink">
                            <input
                              type="checkbox"
                              name="feedback"
                              defaultChecked={s.feedbackEnabled}
                              className="size-5"
                            />
                            Ask for feedback after it (a &ldquo;Rate this session&rdquo; button, and
                            a reminder when it ends)
                          </label>
                          <label className="flex min-h-11 items-center gap-3 text-ink">
                            <input
                              type="checkbox"
                              name="qa"
                              defaultChecked={s.qaEnabled}
                              className="size-5"
                            />
                            Questions and polls on this session (shows the Slido button, or the
                            backup Q&amp;A)
                          </label>
                        </div>

                        <button type="submit" className={primaryButton}>
                          Save this session
                        </button>
                      </form>

                      {isAdded ? (
                        <form action={deleteSession} className="border-t border-line p-4">
                          <FormPending label="Deleting" />
                          <input type="hidden" name="id" value={s.id} />
                          <button type="submit" className={quietButton}>
                            Delete this session
                          </button>
                        </form>
                      ) : null}
                    </details>
                  </li>
                );
              })}
          </ul>
        </section>
      ))}

      <section id="speakers" aria-labelledby="h-speakers" className="scroll-mt-24">
        <h2 id="h-speakers" className="text-xl font-bold text-ink">
          Speakers
        </h2>
        <p className="mt-1 text-ink-soft">
          Fill in real names and titles here. To put a speaker on a session, tick them in that
          session above.
        </p>

        <details className="mt-3 rounded-xl border border-dashed border-line bg-surface">
          <summary className="cursor-pointer px-4 py-3 font-semibold text-ink">
            + Add a speaker
          </summary>
          <form action={addSpeaker} className="space-y-3 border-t border-line p-4">
            <FormPending label="Adding the speaker" />
            <label className={label}>
              Name
              <input name="name" required maxLength={120} className={input} />
            </label>
            <label className={label}>
              Title
              <input name="title" maxLength={200} className={input} />
            </label>
            <label className={label}>
              Organisation
              <input name="organisation" maxLength={160} className={input} />
            </label>
            <label className={label}>
              Short bio (optional)
              <textarea name="bio" rows={3} maxLength={1200} className={input} />
            </label>
            <button type="submit" className={primaryButton}>
              Add speaker
            </button>
          </form>
        </details>

        <ul className="mt-3 space-y-2">
          {config.speakers.map((p) => {
            const uses = speakerUse.get(p.id) ?? 0;
            return (
              <li key={p.id}>
                <details
                  id={`p-${p.id}`}
                  open={openSpeaker === p.id}
                  className="rounded-xl border border-line bg-surface"
                >
                  <summary className="flex cursor-pointer flex-wrap items-center gap-x-3 gap-y-1 px-4 py-3">
                    <span className="min-w-0 flex-1 font-semibold text-ink">
                      {p.name}
                      {p.title ? (
                        <span className="font-normal text-ink-soft">, {p.title}</span>
                      ) : null}
                    </span>
                    <span className="text-xs text-ink-soft">
                      {uses === 0
                        ? 'on no session'
                        : `on ${uses} ${uses === 1 ? 'session' : 'sessions'}`}
                    </span>
                    {addedSpeakers.has(p.id) ? (
                      <Badge>Added</Badge>
                    ) : overlay.speakers?.[p.id] ? (
                      <Badge>Edited</Badge>
                    ) : null}
                  </summary>
                  <form action={saveSpeaker} className="space-y-3 border-t border-line p-4">
                    <FormPending label="Saving" />
                    <input type="hidden" name="id" value={p.id} />
                    <label className={label}>
                      Name
                      <input
                        name="name"
                        required
                        maxLength={120}
                        defaultValue={p.name}
                        className={input}
                      />
                    </label>
                    <label className={label}>
                      Title
                      <input
                        name="title"
                        maxLength={200}
                        defaultValue={p.title}
                        className={input}
                      />
                    </label>
                    <label className={label}>
                      Organisation
                      <input
                        name="organisation"
                        maxLength={160}
                        defaultValue={p.organisation}
                        className={input}
                      />
                    </label>
                    <label className={label}>
                      Short bio
                      <textarea
                        name="bio"
                        rows={3}
                        maxLength={1200}
                        defaultValue={p.bio}
                        className={input}
                      />
                    </label>
                    <button type="submit" className={primaryButton}>
                      Save this speaker
                    </button>
                  </form>
                  {addedSpeakers.has(p.id) ? (
                    <form action={deleteSpeaker} className="border-t border-line p-4">
                      <FormPending label="Deleting" />
                      <input type="hidden" name="id" value={p.id} />
                      <button type="submit" className={quietButton}>
                        Delete this speaker
                      </button>
                    </form>
                  ) : null}
                </details>
              </li>
            );
          })}
        </ul>
      </section>
    </div>
  );
}
