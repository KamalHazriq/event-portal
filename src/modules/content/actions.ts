'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';

import { requireAdminApi } from '@/lib/admin-guard';
import { getEventConfig, loadFileConfig } from '@/lib/config';
import {
  mergeConfig,
  overlayRaw,
  parseOverlay,
  serialiseOverlay,
  type ConfigOverlay,
  type SessionPatch,
} from '@/lib/config-overlay';
import { refreshConfigOverlay, storeOverlay } from '@/lib/config-sync';
import { sessionTypes, type SessionType } from '@/lib/event-schema';
import { multilineText, plainText } from '@/lib/text';
import { recordActivity } from '@/modules/admins/record';

/**
 * Everything the secretariat can change about the agenda and the event
 * details. Each action checks the session itself (a Server Action is a
 * public endpoint), lays the change over what is already saved, checks the
 * result against the same rules as the event file, and only then stores it.
 * Anything that does not fit comes back as a plain message, not a crash.
 */

const AGENDA_PATH = '/admin/agenda';
const EVENT_PATH = '/admin/event-info';

async function begin(): Promise<{ operator: string; overlay: ConfigOverlay }> {
  const auth = await requireAdminApi();
  if (!auth.ok) throw new Error('Not signed in.');
  // The freshest saved edits, so two desks do not overwrite each other.
  await refreshConfigOverlay(true);
  return { operator: auth.session.operator, overlay: parseOverlay(overlayRaw()) };
}

function back(path: string, params: Record<string, string>, anchor?: string): never {
  // The Event info page is in tabs: come back to the one that was saved.
  const withTab =
    path === EVENT_PATH && anchor && anchor !== 'reset' ? { tab: anchor, ...params } : params;
  const query = new URLSearchParams(withTab).toString();
  redirect(`${path}?${query}${anchor ? `#${anchor}` : ''}`);
}

async function commit(
  overlay: ConfigOverlay,
  path: string,
  what: string,
  operator: string,
  anchor?: string,
  extra: Record<string, string> = {},
): Promise<never> {
  const raw = serialiseOverlay(overlay);
  const { problems } = mergeConfig(loadFileConfig(), raw);
  if (problems.length > 0) back(path, { error: problems.join(' | '), ...extra }, anchor);
  await storeOverlay(raw);
  await recordActivity(what, operator);
  // Every attendee page and screen reads the config.
  revalidatePath('/', 'layout');
  return back(path, { saved: '1', ...extra }, anchor);
}

/** "Bus to the dinner" to "bus-to-the-dinner", for an address-safe id. */
function slug(text: string): string {
  return (
    text
      .toLowerCase()
      .replace(/&/g, ' and ')
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 40) || 'item'
  );
}

function uniqueId(text: string, taken: Set<string>): string {
  const base = `x-${slug(text)}`;
  let id = base;
  for (let n = 2; taken.has(id); n += 1) id = `${base}-${n}`;
  taken.add(id);
  return id;
}

function sessionType(value: FormDataEntryValue | null): SessionType {
  return (sessionTypes as readonly string[]).includes(String(value))
    ? (value as SessionType)
    : 'talk';
}

/* ------------------------------------------------------------ event details */

export async function saveEventDetails(formData: FormData): Promise<void> {
  const { operator, overlay } = await begin();
  const name = plainText(formData.get('name'), 160);
  const shortName = plainText(formData.get('shortName'), 60);
  const venue = plainText(formData.get('venue'), 200);
  if (!name || !shortName || !venue) {
    back(EVENT_PATH, { error: 'The event name, short name and venue cannot be empty.' }, 'details');
  }
  overlay.event = {
    name,
    shortName,
    venue,
    tagline: plainText(formData.get('tagline'), 200),
    city: plainText(formData.get('city'), 120),
    helpText: plainText(formData.get('helpText'), 300),
  };
  overlay.footerText = plainText(formData.get('footerText'), 200);

  const url = plainText(formData.get('slidoUrl'), 300);
  const code = plainText(formData.get('slidoCode'), 40);
  if (url || code) {
    overlay.slido = { ...(url ? { eventUrl: url } : {}), ...(code ? { eventCode: code } : {}) };
  }
  await commit(overlay, EVENT_PATH, 'Edited the event details', operator, 'details');
}

/**
 * "Corporate & Engineering Services = CORES", one per line. A line ending in
 * "(division)" marks the division over the departments.
 */
/** Only working sessions can ask for feedback: not a meal, a break or logistics. */
function asksFeedback(type: FormDataEntryValue | null): boolean {
  return !['meal', 'break', 'logistics'].includes(String(type ?? ''));
}

export async function saveDepartments(formData: FormData): Promise<void> {
  const { operator, overlay } = await begin();
  const lines = String(formData.get('departments') ?? '').split(/\r?\n/);
  const departments: { name: string; short: string; division?: boolean }[] = [];
  for (const [index, line] of lines.entries()) {
    if (!line.trim()) continue;
    const [name = '', short = ''] = line.split('=').map((part) => plainText(part, 120));
    if (!name || !short) {
      back(
        EVENT_PATH,
        { error: `Line ${index + 1} needs the form: Full name = SHORT` },
        'departments',
      );
    }
    const division = /\(division\)\s*$/i.test(short);
    const cleanShort = short.replace(/\(division\)\s*$/i, '').trim();
    departments.push({ name, short: cleanShort.slice(0, 16), ...(division ? { division } : {}) });
  }
  overlay.departments = departments;
  await commit(overlay, EVENT_PATH, 'Edited the department short names', operator, 'departments');
}

/* ----------------------------------------------------------------- info page */

export async function saveInfo(formData: FormData): Promise<void> {
  const { operator, overlay } = await begin();
  const taken = new Set(getEventConfig().info?.sections.map((s) => s.id) ?? []);

  const readItems = (prefix: string) => {
    const items: { label: string; text: string }[] = [];
    for (let j = 0; j < 60; j += 1) {
      const label = formData.get(`${prefix}.i${j}.label`);
      if (label === null) break;
      if (formData.get(`${prefix}.i${j}.remove`) === 'on') continue;
      const cleanLabel = plainText(label, 80);
      if (!cleanLabel) continue;
      // A label with no text stays on the page as "Coming soon".
      items.push({
        label: cleanLabel,
        text: plainText(formData.get(`${prefix}.i${j}.text`), 400) || 'To confirm',
      });
    }
    return items;
  };

  const sections: {
    id: string;
    heading: string;
    body: string;
    items: { label: string; text: string }[];
  }[] = [];
  for (let i = 0; i < 40; i += 1) {
    const id = formData.get(`s${i}.id`);
    if (typeof id !== 'string') break;
    if (formData.get(`s${i}.remove`) === 'on') continue;
    const heading = plainText(formData.get(`s${i}.heading`), 100);
    if (!heading) continue;
    sections.push({
      id,
      heading,
      body: multilineText(formData.get(`s${i}.body`), 2000),
      items: readItems(`s${i}`),
    });
  }

  const newHeading = plainText(formData.get('new.heading'), 100);
  if (newHeading) {
    sections.push({
      id: uniqueId(newHeading, taken),
      heading: newHeading,
      body: multilineText(formData.get('new.body'), 2000),
      items: readItems('new'),
    });
  }
  if (sections.length === 0) {
    back(EVENT_PATH, { error: 'The info page needs at least one section.' }, 'info');
  }

  overlay.info = {
    title: plainText(formData.get('title'), 80) || 'Know before you go',
    intro: multilineText(formData.get('intro'), 600),
    sections,
  };
  await commit(overlay, EVENT_PATH, 'Edited the info page', operator, 'info');
}

/* ----------------------------------------------------------------- resources */

/** "Title | https://link", one per line. A line with no link is kept out. */
function parseResourceFiles(text: unknown): { title: string; url: string }[] {
  const out: { title: string; url: string }[] = [];
  for (const line of String(text ?? '').split(/\r?\n/)) {
    const cut = line.lastIndexOf('|');
    if (cut < 0) continue;
    const title = plainText(line.slice(0, cut), 160);
    const url = plainText(line.slice(cut + 1), 600);
    if (title && url) out.push({ title, url });
    if (out.length >= 80) break;
  }
  return out;
}

export async function saveResources(formData: FormData): Promise<void> {
  const { operator, overlay } = await begin();
  const taken = new Set<string>();
  const kept: {
    id: string;
    title: string;
    url: string;
    description: string;
    kind: 'link' | 'file';
    files: { title: string; url: string }[];
  }[] = [];

  for (let j = 0; j < 80; j += 1) {
    const id = formData.get(`r${j}.id`);
    if (typeof id !== 'string') break;
    if (formData.get(`r${j}.remove`) === 'on') continue;
    const title = plainText(formData.get(`r${j}.title`), 160);
    const url = plainText(formData.get(`r${j}.url`), 600);
    if (!title && !url) continue;
    taken.add(id);
    kept.push({
      id,
      title,
      url,
      description: plainText(formData.get(`r${j}.description`), 400),
      kind: formData.get(`r${j}.kind`) === 'file' ? 'file' : 'link',
      files: parseResourceFiles(formData.get(`r${j}.files`)),
    });
  }
  for (let j = 0; j < 5; j += 1) {
    const title = plainText(formData.get(`n${j}.title`), 160);
    const url = plainText(formData.get(`n${j}.url`), 600);
    if (!title && !url) continue;
    kept.push({
      id: uniqueId(title || 'resource', taken),
      title,
      url,
      description: plainText(formData.get(`n${j}.description`), 400),
      kind: formData.get(`n${j}.kind`) === 'file' ? 'file' : 'link',
      files: parseResourceFiles(formData.get(`n${j}.files`)),
    });
  }
  overlay.resources = kept;
  await commit(overlay, EVENT_PATH, 'Edited the resources', operator, 'resources');
}

/* ------------------------------------------------------------------- agenda */

/** Only an https link is kept, so a typo never breaks the agenda. */
function slidesLink(value: FormDataEntryValue | null): string | undefined {
  const url = plainText(value, 600);
  return /^https:\/\/[^\s]+$/.test(url) ? url : undefined;
}

export async function saveSession(formData: FormData): Promise<void> {
  const { operator, overlay } = await begin();
  const id = plainText(formData.get('id'), 64);
  const patch: SessionPatch = {
    title: plainText(formData.get('title'), 160),
    start: plainText(formData.get('start'), 5),
    end: plainText(formData.get('end'), 5),
    room: plainText(formData.get('room'), 120),
    description: multilineText(formData.get('description'), 1500),
    type: sessionType(formData.get('type')),
    hidden: formData.get('show') !== 'on',
    // Meals, breaks and logistics never ask for feedback.
    feedbackEnabled: formData.get('feedback') === 'on' && asksFeedback(formData.get('type')),
    qaEnabled: formData.get('qa') === 'on',
    speakerIds: formData
      .getAll('speaker')
      .map((v) => plainText(v, 64))
      .filter(Boolean),
    slidesUrl: slidesLink(formData.get('slidesUrl')),
    slidesLabel: plainText(formData.get('slidesLabel'), 40),
  };
  if (!patch.slidesUrl) delete patch.slidesUrl;
  if (!patch.slidesLabel) delete patch.slidesLabel;
  const clearLabel = !plainText(formData.get('slidesLabel'), 40);
  const clearSlides = !slidesLink(formData.get('slidesUrl'));

  // "Other": names typed in. Someone already on the list is just ticked; a new
  // name becomes a speaker of their own, ready to tick on other sessions too.
  const typed = String(formData.get('otherSpeaker') ?? '')
    .split(',')
    .map((n) => plainText(n, 120))
    .filter(Boolean);
  if (typed.length > 0) {
    const known = [...getEventConfig().speakers, ...(overlay.addedSpeakers ?? [])];
    const takenIds = new Set(known.map((sp) => sp.id));
    for (const name of typed) {
      const match = known.find((sp) => sp.name.toLowerCase() === name.toLowerCase());
      if (match) {
        patch.speakerIds = [...new Set([...(patch.speakerIds ?? []), match.id])];
        continue;
      }
      const speakerId = uniqueId(name, takenIds);
      overlay.addedSpeakers = [
        ...(overlay.addedSpeakers ?? []),
        { id: speakerId, name, title: '', organisation: '', bio: '' },
      ];
      known.push({ id: speakerId, name, title: '', organisation: '', bio: '' });
      patch.speakerIds = [...new Set([...(patch.speakerIds ?? []), speakerId])];
    }
  }

  const added = overlay.addedSessions?.find((a) => a.session.id === id);
  if (added) {
    added.session = { ...added.session, ...patch } as typeof added.session;
    if (clearSlides) delete added.session.slidesUrl;
    if (clearLabel) delete added.session.slidesLabel;
  } else if (getEventConfig().days.some((d) => d.sessions.some((s) => s.id === id))) {
    const merged: SessionPatch = { ...overlay.sessions?.[id], ...patch };
    if (clearSlides) delete merged.slidesUrl;
    if (clearLabel) delete merged.slidesLabel;
    overlay.sessions = { ...overlay.sessions, [id]: merged };
  } else {
    back(AGENDA_PATH, { error: 'That session no longer exists.' });
  }
  await commit(overlay, AGENDA_PATH, `Edited the session "${patch.title}"`, operator, `s-${id}`, {
    open: id,
  });
}

export async function addSession(formData: FormData): Promise<void> {
  const { operator, overlay } = await begin();
  const config = getEventConfig();
  const dayId = plainText(formData.get('dayId'), 64);
  const title = plainText(formData.get('title'), 160);
  if (!config.days.some((d) => d.id === dayId) || !title) {
    back(AGENDA_PATH, { error: 'A new session needs a day and a title.' }, `add-${dayId}`);
  }
  const taken = new Set(config.days.flatMap((d) => d.sessions.map((s) => s.id)));
  const id = uniqueId(title, taken);

  overlay.addedSessions = [
    ...(overlay.addedSessions ?? []),
    {
      dayId,
      session: {
        id,
        title,
        start: plainText(formData.get('start'), 5),
        end: plainText(formData.get('end'), 5),
        room: plainText(formData.get('room'), 120),
        description: multilineText(formData.get('description'), 1500),
        objectives: [],
        speakerIds: [],
        type: sessionType(formData.get('type')),
        qaEnabled: false,
        feedbackEnabled: formData.get('feedback') === 'on' && asksFeedback(formData.get('type')),
        hidden: false,
      },
    },
  ];
  await commit(overlay, AGENDA_PATH, `Added the session "${title}"`, operator, `s-${id}`, {
    open: id,
  });
}

/** A session someone added can be deleted; one from the file is hidden instead. */
export async function deleteSession(formData: FormData): Promise<void> {
  const { operator, overlay } = await begin();
  const id = plainText(formData.get('id'), 64);
  overlay.addedSessions = (overlay.addedSessions ?? []).filter((a) => a.session.id !== id);
  await commit(overlay, AGENDA_PATH, 'Deleted an added session', operator);
}

/* ----------------------------------------------------------------- speakers */

export async function saveSpeaker(formData: FormData): Promise<void> {
  const { operator, overlay } = await begin();
  const id = plainText(formData.get('id'), 64);
  const patch = {
    name: plainText(formData.get('name'), 120),
    title: plainText(formData.get('title'), 200),
    organisation: plainText(formData.get('organisation'), 160),
    bio: multilineText(formData.get('bio'), 1200),
  };
  const added = overlay.addedSpeakers?.find((s) => s.id === id);
  if (added) Object.assign(added, patch);
  else if (getEventConfig().speakers.some((s) => s.id === id)) {
    overlay.speakers = { ...overlay.speakers, [id]: { ...overlay.speakers?.[id], ...patch } };
  } else {
    back(AGENDA_PATH, { error: 'That speaker no longer exists.' }, 'speakers');
  }
  await commit(overlay, AGENDA_PATH, `Edited the speaker "${patch.name}"`, operator, `p-${id}`, {
    openSpeaker: id,
  });
}

export async function addSpeaker(formData: FormData): Promise<void> {
  const { operator, overlay } = await begin();
  const name = plainText(formData.get('name'), 120);
  if (!name) back(AGENDA_PATH, { error: 'A new speaker needs a name.' }, 'speakers');
  const taken = new Set(getEventConfig().speakers.map((s) => s.id));
  const id = uniqueId(name, taken);
  overlay.addedSpeakers = [
    ...(overlay.addedSpeakers ?? []),
    {
      id,
      name,
      title: plainText(formData.get('title'), 200),
      organisation: plainText(formData.get('organisation'), 160),
      bio: multilineText(formData.get('bio'), 1200),
    },
  ];
  await commit(overlay, AGENDA_PATH, `Added the speaker "${name}"`, operator, `p-${id}`, {
    openSpeaker: id,
  });
}

/** Deletes an added speaker, and takes them off any session they were on. */
export async function deleteSpeaker(formData: FormData): Promise<void> {
  const { operator, overlay } = await begin();
  const id = plainText(formData.get('id'), 64);
  overlay.addedSpeakers = (overlay.addedSpeakers ?? []).filter((s) => s.id !== id);
  const without = (ids: string[]) => ids.filter((x) => x !== id);
  for (const patch of Object.values(overlay.sessions ?? {})) {
    if (patch.speakerIds) patch.speakerIds = without(patch.speakerIds);
  }
  for (const added of overlay.addedSessions ?? []) {
    added.session.speakerIds = without(added.session.speakerIds);
  }
  await commit(overlay, AGENDA_PATH, 'Deleted an added speaker', operator, 'speakers');
}

/* -------------------------------------------------------------------- reset */

/** Drops every saved edit, so the event file is what shows again. */
export async function resetContent(formData: FormData): Promise<void> {
  const { operator } = await begin();
  if (formData.get('confirm') !== 'yes') {
    back(EVENT_PATH, { error: 'Tick the box to confirm the reset.' }, 'reset');
  }
  await storeOverlay(null);
  await recordActivity('Reset the agenda and event details to the event file', operator);
  revalidatePath('/', 'layout');
  back(EVENT_PATH, { reset: '1' }, 'reset');
}
