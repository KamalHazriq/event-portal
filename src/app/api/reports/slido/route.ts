/**
 * Uploading (or removing) the Slido Excel export, so poll and Q&A results
 * land in the same report.
 *
 * A plain form POST that answers with a redirect, so it works with no
 * JavaScript, like the sign in and feedback forms. The outcome travels back
 * as a short code in the address, never as the file's contents.
 */
import { NextResponse } from 'next/server';

import { getData } from '@/data';
import { requireAdminApi } from '@/lib/admin-guard';
import { LIMITS, rateLimit } from '@/lib/rate-limit';
import { plainText } from '@/lib/text';
import { readXlsx, XlsxError } from '@/lib/xlsx/read';
import { parseSlidoWorkbook, SLIDO_LIMITS } from '@/modules/reports/slido';

function back(params: Record<string, string>): NextResponse {
  const query = new URLSearchParams(params).toString();
  return new NextResponse(null, { status: 303, headers: { Location: `/admin/reports?${query}` } });
}

export async function POST(request: Request): Promise<Response> {
  const auth = await requireAdminApi();
  if (!auth.ok) return auth.response;

  if (!rateLimit(`upload:${auth.session.operator}`, LIMITS.upload).allowed) {
    return back({ slido: 'too-many' });
  }

  // Refuse an oversized body before reading it, when the browser says how big it is.
  const declared = Number(request.headers.get('content-length') ?? 0);
  if (declared > SLIDO_LIMITS.maxFileBytes + 64 * 1024) return back({ slido: 'too-big' });

  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return back({ slido: 'no-file' });
  }

  const data = getData();

  if (String(form.get('intent') ?? '') === 'clear') {
    await data.imports.clear('slido');
    return back({ slido: 'cleared' });
  }

  const file = form.get('file');
  if (!(file instanceof File) || file.size === 0) return back({ slido: 'no-file' });
  if (file.size > SLIDO_LIMITS.maxFileBytes) return back({ slido: 'too-big' });
  if (!/\.xlsx$/i.test(file.name)) return back({ slido: 'not-xlsx' });

  let parsed;
  try {
    const sheets = readXlsx(Buffer.from(await file.arrayBuffer()), {
      maxRows: SLIDO_LIMITS.maxRowsPerSheet + 50,
    });
    parsed = parseSlidoWorkbook(sheets);
  } catch (error) {
    // Never echo the file back. A short code is enough to explain it.
    return back({ slido: error instanceof XlsxError ? 'unreadable' : 'failed' });
  }

  if (parsed.kept.length === 0) return back({ slido: 'nothing-found' });

  await data.imports.replace('slido', parsed.kept, {
    fileName: plainText(file.name, 200),
    byOperator: auth.session.operator,
  });

  return back({
    slido: 'imported',
    kept: String(parsed.kept.length),
    skipped: String(parsed.skipped.length),
  });
}
