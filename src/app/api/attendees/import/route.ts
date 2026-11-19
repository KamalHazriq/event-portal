/**
 * Uploading the participant list (Excel or CSV), or removing everyone to
 * start again after a wrong upload.
 *
 * A plain form POST answering with a redirect, so it works with no
 * JavaScript. The outcome travels back as counts and line numbers in the
 * address, never as names.
 *
 * Re-uploading a corrected list updates people by staff number, so nobody
 * is duplicated and check ins survive.
 */
import { NextResponse } from 'next/server';

import { getData } from '@/data';
import { requireAdminApi } from '@/lib/admin-guard';
import { parseAttendeeCsv, parseAttendeeTable } from '@/lib/attendee-import';
import { getEventConfig } from '@/lib/config';
import { LIMITS, rateLimit } from '@/lib/rate-limit';
import { readXlsx, XlsxError } from '@/lib/xlsx/read';
import { recordActivity } from '@/modules/admins/record';

const MAX_BYTES = 2 * 1024 * 1024;

function back(params: Record<string, string>): NextResponse {
  const query = new URLSearchParams(params).toString();
  return new NextResponse(null, {
    status: 303,
    headers: { Location: `/admin/attendees?${query}` },
  });
}

export async function POST(request: Request): Promise<Response> {
  const auth = await requireAdminApi();
  if (!auth.ok) return auth.response;
  const operator = auth.session.operator;

  if (!rateLimit(`attendee-upload:${operator}`, LIMITS.attendeeUpload).allowed) {
    return back({ result: 'too-many' });
  }
  const declared = Number(request.headers.get('content-length') ?? 0);
  if (declared > MAX_BYTES + 64 * 1024) return back({ result: 'too-big' });

  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return back({ result: 'no-file' });
  }

  const data = getData();

  if (String(form.get('intent') ?? '') === 'clear') {
    if (form.get('confirm') !== 'yes') return back({ result: 'not-confirmed' });
    // Never on the day: once anyone has arrived, the list is not wiped.
    const config = getEventConfig();
    const arrived = await Promise.all(
      config.days.map((day) => data.checkIns.headcount(day.id).then((h) => h.arrived)),
    );
    if (arrived.some((n) => n > 0)) return back({ result: 'has-check-ins' });
    const removed = await data.attendees.removeAll();
    await recordActivity(`Removed all ${removed} people from the list`, operator);
    return back({ result: 'cleared', removed: String(removed) });
  }

  const file = form.get('file');
  if (!(file instanceof File) || file.size === 0) return back({ result: 'no-file' });
  if (file.size > MAX_BYTES) return back({ result: 'too-big' });

  const bytes = Buffer.from(await file.arrayBuffer());
  let parsed;
  if (/\.xlsx$/i.test(file.name)) {
    try {
      const [first] = readXlsx(bytes, { maxRows: 2000 });
      parsed = parseAttendeeTable(first?.rows ?? []);
    } catch (error) {
      if (error instanceof XlsxError) return back({ result: 'unreadable' });
      throw error;
    }
  } else if (/\.csv$/i.test(file.name)) {
    parsed = parseAttendeeCsv(bytes.toString('utf8').replace(/^﻿/, ''));
  } else {
    return back({ result: 'wrong-type' });
  }

  if (parsed.rows.length === 0) {
    return back({
      result: 'nothing',
      problems: parsed.problems
        .slice(0, 5)
        .map((p) => `${p.row}: ${p.reason}`)
        .join(' | '),
    });
  }

  const result = await data.attendees.importRows(parsed.rows);
  await recordActivity(
    `Uploaded the participant list: ${result.created} added, ${result.updated} updated`,
    operator,
  );
  const problems = [...parsed.problems, ...result.skipped];
  return back({
    result: 'imported',
    created: String(result.created),
    updated: String(result.updated),
    unchanged: String(result.unchanged),
    skipped: String(problems.length),
    problems: problems
      .slice(0, 5)
      .map((p) => `${p.row}: ${p.reason}`)
      .join(' | '),
  });
}
