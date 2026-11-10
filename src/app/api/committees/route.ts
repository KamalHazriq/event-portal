/**
 * Uploading or removing a committee's Excel, and choosing who can see the
 * summaries. A plain form POST that answers with a redirect, so it works
 * with no JavaScript. The outcome travels back as a short code, never as
 * the file's contents.
 */
import { NextResponse } from 'next/server';

import { getData } from '@/data';
import { requireAdminApi } from '@/lib/admin-guard';
import { getEventConfig } from '@/lib/config';
import { LIMITS, rateLimit } from '@/lib/rate-limit';
import { plainText } from '@/lib/text';
import { readXlsx, XlsxError } from '@/lib/xlsx/read';
import {
  COMMITTEE_ACCESS_KEY,
  COMMITTEE_LIMITS,
  committeeSource,
  parseCommitteeWorkbook,
} from '@/modules/committees/logic';

function back(params: Record<string, string>): NextResponse {
  const query = new URLSearchParams(params).toString();
  return new NextResponse(null, {
    status: 303,
    headers: { Location: `/admin/committees?${query}` },
  });
}

export async function POST(request: Request): Promise<Response> {
  const auth = await requireAdminApi();
  if (!auth.ok) return auth.response;

  const config = getEventConfig();
  if (!config.features.committees) return new Response('Not found', { status: 404 });

  if (!rateLimit(`upload:${auth.session.operator}`, LIMITS.upload).allowed) {
    return back({ result: 'too-many' });
  }

  const declared = Number(request.headers.get('content-length') ?? 0);
  if (declared > COMMITTEE_LIMITS.maxFileBytes + 64 * 1024) return back({ result: 'too-big' });

  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return back({ result: 'no-file' });
  }

  const data = getData();
  const intent = String(form.get('intent') ?? 'upload');

  if (intent === 'access') {
    const everyone = String(form.get('access') ?? '') === 'everyone';
    await data.settings.set(COMMITTEE_ACCESS_KEY, everyone ? 'everyone' : 'secretariat');
    return back({ result: 'access-saved' });
  }

  // Only a committee named in config/event.json, so nothing else can be stored.
  const id = plainText(form.get('committee'), 24);
  const committee = config.committees.find((c) => c.id === id);
  if (!committee) return back({ result: 'no-committee' });

  if (intent === 'clear') {
    await data.imports.clear(committeeSource(committee.id));
    return back({ result: 'cleared', c: committee.id });
  }

  const file = form.get('file');
  if (!(file instanceof File) || file.size === 0)
    return back({ result: 'no-file', c: committee.id });
  if (file.size > COMMITTEE_LIMITS.maxFileBytes)
    return back({ result: 'too-big', c: committee.id });
  if (!/\.xlsx$/i.test(file.name)) return back({ result: 'not-xlsx', c: committee.id });

  let parsed;
  try {
    parsed = parseCommitteeWorkbook(
      readXlsx(Buffer.from(await file.arrayBuffer()), {
        maxSheets: COMMITTEE_LIMITS.maxSheets,
        maxRows: COMMITTEE_LIMITS.maxRowsPerSheet + 50,
        maxColumns: COMMITTEE_LIMITS.maxColumns,
      }),
    );
  } catch (error) {
    return back({ result: error instanceof XlsxError ? 'unreadable' : 'failed', c: committee.id });
  }

  if (parsed.kept.length === 0) return back({ result: 'nothing-found', c: committee.id });

  await data.imports.replace(committeeSource(committee.id), parsed.kept, {
    fileName: plainText(file.name, 200),
    byOperator: auth.session.operator,
  });

  return back({ result: 'imported', c: committee.id, kept: String(parsed.kept.length) });
}
