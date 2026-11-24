import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';

import { getData } from '@/data';
import { getEventConfig } from '@/lib/config';
import { DEVICE_COOKIE, readDeviceId } from '@/lib/device';
import { cookies } from 'next/headers';

import { submitFeedback } from '@/modules/feedback/actions';
import { StarRating } from '@/modules/feedback/components/StarRating';
import {
  findFeedbackForm,
  formIdFromSlug,
  MAX_COMMENT,
  problemMessage,
  type SubmissionProblem,
  bestSessionChoices,
} from '@/modules/feedback/logic';
import { readFormSettings } from '@/modules/feedback/settings';
import { currentPlayer } from '@/modules/points/server';
import { FormPending } from '@/components/FormPending';

export const dynamic = 'force-dynamic';

type PageProps = {
  params: Promise<{ slug: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

function first(value: string | string[] | undefined): string | null {
  if (typeof value === 'string') return value;
  if (Array.isArray(value)) return value[0] ?? null;
  return null;
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { slug } = await params;
  const form = findFeedbackForm(getEventConfig(), formIdFromSlug(slug));
  return { title: form ? `Feedback: ${form.title}` : 'Feedback' };
}

export default async function FeedbackPage({ params, searchParams }: PageProps) {
  const config = getEventConfig();
  if (!config.features.feedback) notFound();

  const [{ slug }, query] = await Promise.all([params, searchParams]);
  const form = findFeedbackForm(config, formIdFromSlug(slug));
  if (!form) notFound();

  const [settings, me] = await Promise.all([readFormSettings(form.id), currentPlayer()]);
  const state = first(query.state);

  // Already answered on this device? Say so instead of offering the form.
  const store = await cookies();
  const deviceId = readDeviceId(store.get(DEVICE_COOKIE)?.value);
  const alreadyAnswered =
    deviceId !== null && (await getData().feedback.hasSubmitted(form.id, deviceId));

  if (state === 'thanks' || (alreadyAnswered && state !== 'invalid')) {
    return (
      <Done
        heading={state === 'thanks' ? 'Thank you' : 'You have already answered this one'}
        detail={
          state === 'thanks'
            ? 'Your feedback has been recorded.'
            : 'Each form takes one answer per phone, so there is nothing more to do here.'
        }
      />
    );
  }

  if (!settings.open) {
    return (
      <Done
        heading="This form is closed"
        detail="The secretariat has closed it. If you still want to say something, have a word with them at the desk."
      />
    );
  }

  const problems = (first(query.problems) ?? '')
    .split(',')
    .filter((value): value is SubmissionProblem => value.length > 0);

  const otherSessions = bestSessionChoices(config);

  // Nothing is anonymous: say who you are first, then the form.
  if (!me) {
    return (
      <div className="space-y-4 py-2">
        <h1 className="text-2xl font-bold leading-tight text-ink">{form.title}</h1>
        <p className="rounded-lg border border-line bg-surface p-4 text-ink">
          Feedback is sent with your name. Say who you are first, then come back here.
        </p>
        <Link
          href={`/welcome?next=${encodeURIComponent(`/feedback/${slug}`)}`}
          className="inline-flex min-h-11 items-center rounded-lg bg-primary px-5 font-bold text-on-primary no-underline"
        >
          Find my name
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-5 py-2">
      <header>
        <h1 className="text-2xl font-bold leading-tight text-ink">{form.title}</h1>
        <p className="mt-1 text-ink-soft">{form.context}</p>
      </header>

      {state === 'duplicate' ? (
        <p role="status" className="rounded-lg border border-line bg-muted p-3 text-ink">
          That one was already recorded from this device.
        </p>
      ) : null}

      {state === 'too-many' ? (
        <p role="alert" className="rounded-lg border-2 border-warning bg-warning/10 p-3 text-ink">
          That is a lot of answers in a short time. Please wait a few minutes and try again.
        </p>
      ) : null}

      {problems.length > 0 ? (
        <div role="alert" className="rounded-lg border-2 border-warning bg-warning/10 p-3 text-ink">
          <p className="font-bold">Please check the form</p>
          <ul className="mt-1 list-disc pl-5">
            {problems.map((problem) => (
              <li key={problem}>{problemMessage(problem)}</li>
            ))}
          </ul>
        </div>
      ) : null}

      <form action={submitFeedback} className="space-y-5">
        <FormPending label="Sending" />
        <input type="hidden" name="formId" value={form.id} />

        <StarRating
          legend={form.kind === 'event' ? 'Overall, how was the summit?' : 'How was this session?'}
        />

        {form.kind === 'event' ? (
          <div>
            <label htmlFor="bestSessionId" className="block font-semibold text-ink">
              Which session was the most useful?
            </label>
            <select
              id="bestSessionId"
              name="bestSessionId"
              defaultValue=""
              className="mt-1 min-h-11 w-full rounded-lg border border-line bg-surface px-3 py-2 text-ink"
            >
              <option value="">No answer</option>
              {otherSessions.map((session) => (
                <option key={session.id} value={session.id}>
                  {session.day}: {session.title}
                </option>
              ))}
            </select>
          </div>
        ) : null}

        {form.kind === 'event' ? (
          <div>
            <label htmlFor="improve" className="block font-semibold text-ink">
              One thing we should improve
            </label>
            <textarea
              id="improve"
              name="improve"
              rows={3}
              maxLength={MAX_COMMENT}
              className="mt-1 w-full rounded-lg border border-line bg-surface px-3 py-2 text-ink"
            />
          </div>
        ) : null}

        <div>
          <label htmlFor="comment" className="block font-semibold text-ink">
            {form.kind === 'event' ? 'Anything else?' : 'Any comments?'}{' '}
            <span className="font-normal text-ink-soft">(optional)</span>
          </label>
          <textarea
            id="comment"
            name="comment"
            rows={4}
            maxLength={MAX_COMMENT}
            className="mt-1 w-full rounded-lg border border-line bg-surface px-3 py-2 text-ink"
          />
        </div>

        <p className="rounded-lg border border-line bg-muted p-3 text-sm text-ink">
          Sent as <strong>{me?.name}</strong>.
        </p>

        <button
          type="submit"
          className="min-h-12 w-full rounded-lg bg-primary px-4 py-3 text-lg font-bold text-on-primary"
        >
          Send feedback
        </button>

        <p className="text-sm text-ink-soft">
          One answer per phone. You cannot change it afterwards, so have a quick read before you
          send.
        </p>
      </form>
    </div>
  );
}

function Done({ heading, detail }: { heading: string; detail: string }) {
  return (
    <div className="space-y-4 py-8">
      <h1 className="text-2xl font-bold text-ink">{heading}</h1>
      <p className="text-ink">{detail}</p>
      <div className="flex flex-wrap gap-3">
        <Link
          href="/"
          className="inline-flex min-h-11 items-center rounded-lg bg-primary px-4 py-2.5 font-bold text-on-primary no-underline"
        >
          Back to the portal
        </Link>
        <Link
          href="/agenda"
          className="inline-flex min-h-11 items-center rounded-lg border border-line bg-surface px-4 py-2.5 font-bold text-ink no-underline"
        >
          See the agenda
        </Link>
      </div>
    </div>
  );
}
