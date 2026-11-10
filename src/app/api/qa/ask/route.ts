/** An attendee asks a question (Module 2, backup Q&A). */
import { getData } from '@/data';
import { getEventConfig } from '@/lib/config';
import { LIMITS, rateLimit } from '@/lib/rate-limit';
import { multilineText, plainText } from '@/lib/text';
import { deviceIdOrNew, readBackupMode, respond } from '@/modules/backup/server';
import {
  MAX_QUESTION,
  MAX_QUESTION_NAME,
  premoderationOn,
  QA_KEYS,
  validateQuestion,
} from '@/modules/qa/logic';

export async function POST(request: Request): Promise<Response> {
  const config = getEventConfig();
  const form = await request.formData().catch(() => null);
  const sessionId = plainText(form?.get('sessionId'), 64);
  const page = `/qa/${encodeURIComponent(sessionId)}`;

  const session = config.days.flatMap((d) => d.sessions).find((s) => s.id === sessionId);
  if (!form || !config.features.qa || !session?.qaEnabled || !(await readBackupMode())) {
    return respond(request, '/', 'closed', false, 403);
  }

  const deviceId = await deviceIdOrNew();
  if (!rateLimit(`qa-ask:${deviceId}`, LIMITS.qaAsk).allowed) {
    return respond(request, page, 'slow-down', false, 429);
  }

  const data = getData();
  // One more than the limit, so "too long" is reported rather than cut off.
  const text = multilineText(form.get('text'), MAX_QUESTION + 1).replace(/\s*\n\s*/g, ' ');
  const checked = validateQuestion({
    text,
    alreadyAsked: await data.questions.countByDevice(sessionId, deviceId),
  });
  if (!checked.ok) return respond(request, page, checked.problem, false);

  const waits = premoderationOn(await data.settings.get(QA_KEYS.premoderation(sessionId)));
  await data.questions.add({
    sessionId,
    text: text.trim(),
    // Each person chooses: a name, or blank to stay anonymous.
    name: plainText(form.get('name'), MAX_QUESTION_NAME),
    deviceId,
    status: waits ? 'pending' : 'approved',
  });

  return respond(request, page, waits ? 'waiting' : 'asked', true);
}
