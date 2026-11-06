'use server';

import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';

import { getData } from '@/data';
import { getEventConfig } from '@/lib/config';
import { deviceCookieOptions, DEVICE_COOKIE, newDeviceId, readDeviceId } from '@/lib/device';
import { LIMITS, rateLimit } from '@/lib/rate-limit';

import {
  findFeedbackForm,
  slugForFormId,
  validateSubmission,
  type SubmissionProblem,
} from './logic';
import { readFormSettings } from './settings';

/**
 * Takes one feedback submission.
 *
 * A Server Action used as a plain form action, so the form still works with
 * no JavaScript. The result is carried back in the web address rather than in
 * component state, for the same reason.
 *
 * The docs are clear that an action is a public endpoint whatever renders the
 * form, so everything here is checked server side: the form has to exist in
 * the config, it has to be open, and the device has to not have answered yet.
 */
export async function submitFeedback(formData: FormData): Promise<void> {
  const config = getEventConfig();

  if (!config.features.feedback) redirect('/');

  const formId = String(formData.get('formId') ?? '');
  const form = findFeedbackForm(config, formId);
  // An id that is not a real form is not an error worth explaining.
  if (!form) redirect('/');

  const back = (state: string, problems: SubmissionProblem[] = []): never => {
    const query = new URLSearchParams({ state });
    if (problems.length > 0) query.set('problems', problems.join(','));
    redirect(`/feedback/${slugForFormId(form.id)}?${query.toString()}`);
  };

  const settings = await readFormSettings(form.id);
  if (!settings.open) return back('closed');

  // Read the device id, or issue one. A first submission always has none.
  const store = await cookies();
  let deviceId = readDeviceId(store.get(DEVICE_COOKIE)?.value);
  if (!deviceId) {
    deviceId = newDeviceId();
    store.set(DEVICE_COOKIE, deviceId, deviceCookieOptions);
  }

  if (!rateLimit(`feedback:${deviceId}`, LIMITS.feedback).allowed) {
    return back('too-many');
  }

  const data = getData();
  if (await data.feedback.hasSubmitted(form.id, deviceId)) return back('duplicate');

  const knownSessionIds = new Set(
    config.days.flatMap((day) => day.sessions.map((session) => session.id)),
  );

  const validated = validateSubmission(
    form,
    settings.anonymity,
    {
      rating: formData.get('rating'),
      comment: formData.get('comment'),
      improve: formData.get('improve'),
      bestSessionId: formData.get('bestSessionId'),
      name: formData.get('name'),
    },
    knownSessionIds,
  );

  if (!validated.ok) return back('invalid', validated.problems);

  const { rating, answers, displayName } = validated.value;

  const result = await data.feedback.submit({
    formId: form.id,
    kind: form.kind,
    rating,
    answers,
    // Nothing links a submission to an attendee record. With no login, a
    // name is what the person typed, and claiming more would be dishonest.
    attendeeId: null,
    displayName,
    deviceId,
  });

  return back(result.duplicate ? 'duplicate' : 'thanks');
}
