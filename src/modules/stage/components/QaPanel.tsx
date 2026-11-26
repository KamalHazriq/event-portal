import { getData } from '@/data';
import { getEventConfig } from '@/lib/config';
import { resolveEventNow } from '@/lib/time';
import {
  moderateQuestion,
  setPremoderation,
  showQuestionsOnScreen,
} from '@/modules/backup/actions';
import { premoderationOn, QA_KEYS, QUESTION_STATUS_LABEL, rankQuestions } from '@/modules/qa/logic';
import { buildAgenda, findNowAndNext } from '@/modules/schedule/logic';
import { isInteractiveSession } from '@/modules/talk/logic';

function Act({
  id,
  act,
  label,
  primary = false,
}: {
  id: string;
  act: string;
  label: string;
  primary?: boolean;
}) {
  return (
    <form action={moderateQuestion}>
      <input type="hidden" name="id" value={id} />
      <input type="hidden" name="act" value={act} />
      <button
        type="submit"
        className={
          primary
            ? 'min-h-11 rounded-lg bg-primary px-4 text-sm font-bold text-on-primary'
            : 'min-h-11 rounded-lg border border-line px-4 text-sm font-semibold text-ink'
        }
      >
        {label}
      </button>
    </form>
  );
}

/**
 * Top questions on the stage console: pick the talk, approve what comes in,
 * pin the one to take next. The big screen shows the same list.
 */
export async function QaPanel() {
  const config = getEventConfig();
  const data = getData();
  const agenda = buildAgenda(config);
  const sessions = agenda.sessions.filter((s) => s.qaEnabled && isInteractiveSession(s));
  const live = findNowAndNext(agenda, resolveEventNow({ timezone: config.event.timezone })).live;
  const chosen = await data.settings.get(QA_KEYS.screenSession);
  const session =
    sessions.find((s) => s.id === chosen) ??
    sessions.find((s) => live.some((l) => l.id === s.id)) ??
    sessions[0];

  if (!session) {
    return (
      <section className="rounded-xl border border-line bg-surface p-4 text-ink-soft">
        No session has Q&A switched on.
      </section>
    );
  }

  const [all, premod] = await Promise.all([
    data.questions.listBySession(session.id),
    data.settings.get(QA_KEYS.premoderation(session.id)).then(premoderationOn),
  ]);
  const queue = rankQuestions(all.filter((q) => q.status === 'pending' || q.status === 'approved'));
  const pending = all.filter((q) => q.status === 'pending').length;

  return (
    <section className="space-y-3 rounded-xl border border-line bg-surface p-4">
      <h2 className="text-sm font-bold uppercase tracking-wide text-ink-soft">Top questions</h2>
      <form action={showQuestionsOnScreen} className="flex flex-wrap items-end gap-2">
        <label className="min-w-0 flex-1 text-sm font-semibold text-ink">
          Talk
          <select
            name="sessionId"
            defaultValue={session.id}
            className="mt-1 block min-h-11 w-full rounded-lg border border-line bg-canvas px-3 font-normal text-ink"
          >
            {sessions.map((s) => (
              <option key={s.id} value={s.id}>
                {live.some((l) => l.id === s.id) ? 'On now: ' : `${s.dayLabel}: `}
                {s.title}
              </option>
            ))}
          </select>
        </label>
        <button
          type="submit"
          className="min-h-11 rounded-lg bg-primary px-4 font-bold text-on-primary"
        >
          Show this talk&apos;s questions
        </button>
      </form>

      <form action={setPremoderation} className="flex flex-wrap items-center gap-3">
        <input type="hidden" name="sessionId" value={session.id} />
        <input type="hidden" name="mode" value={premod ? 'off' : 'on'} />
        <button
          type="submit"
          className="min-h-11 rounded-lg border border-line px-4 text-sm font-semibold text-ink"
        >
          {premod ? 'Approval first: on' : 'Approval first: off'}
        </button>
        <span className="text-sm text-ink-soft">{pending} waiting for approval</span>
      </form>

      {queue.length === 0 ? (
        <p className="text-ink-soft">No questions yet. They appear here by themselves.</p>
      ) : (
        <ul className="max-h-[32rem] space-y-2 overflow-y-auto">
          {queue.map((q) => (
            <li
              key={q.id}
              className={[
                'rounded-lg bg-canvas p-3',
                q.pinned ? 'border-2 border-primary' : 'border border-line',
              ].join(' ')}
            >
              <div className="flex items-start justify-between gap-3">
                <p className="min-w-0 break-words text-ink">{q.text}</p>
                <span className="shrink-0 font-bold tabular-nums text-ink">{q.votes}</span>
              </div>
              <p className="text-xs text-ink-soft">
                {q.name || 'Anonymous'}. {QUESTION_STATUS_LABEL[q.status]}
                {q.pinned ? ', pinned' : ''}
              </p>
              <div className="mt-2 flex flex-wrap gap-2">
                {q.status === 'pending' ? (
                  <Act id={q.id} act="approve" label="Approve" primary />
                ) : null}
                {q.status === 'approved' ? (
                  <Act
                    id={q.id}
                    act={q.pinned ? 'unpin' : 'pin'}
                    label={q.pinned ? 'Unpin' : 'Pin'}
                    primary={!q.pinned}
                  />
                ) : null}
                <Act id={q.id} act="answered" label="Answered" />
                <Act id={q.id} act="hide" label="Hide" />
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
