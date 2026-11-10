/**
 * Reads everything the report needs, through the data adapter. Server only.
 */
import { getData } from '@/data';
import { getEventConfig } from '@/lib/config';

import type { ReportInput } from './logic';

export async function loadReportInput(generatedAt = new Date()): Promise<ReportInput> {
  const config = getEventConfig();
  const data = getData();

  const [attendees, perDay, feedback, summaries, imports, luckyDraw, photos] = await Promise.all([
    data.attendees.list(),
    Promise.all(config.days.map((day) => data.checkIns.listByDay(day.id))),
    data.feedback.listAll(),
    data.feedback.summaries(),
    data.imports.list('slido'),
    data.luckyDraw.list(),
    data.photos.list(),
  ]);

  return {
    config,
    attendees,
    // listByDay carries the person too; the report only needs the check in.
    checkIns: perDay.flat().map(({ attendee: _attendee, ...checkIn }) => checkIn),
    feedback,
    summaries,
    imports,
    luckyDraw,
    photos: {
      approved: photos.filter((p) => p.status === 'approved').length,
      total: photos.length,
    },
    generatedAt,
  };
}
