/** What the reports page says after a Slido upload. Plain English, no codes. */
export function slidoMessage(
  code: string | null,
  kept: string | null,
  skipped: string | null,
): { tone: 'ok' | 'problem'; text: string } | null {
  switch (code) {
    case 'imported': {
      const k = Number(kept) || 0;
      const s = Number(skipped) || 0;
      return {
        tone: 'ok',
        text:
          `Imported ${k} ${k === 1 ? 'sheet' : 'sheets'} of polls and questions.` +
          (s > 0
            ? ` Left out ${s} other ${s === 1 ? 'sheet' : 'sheets'}, such as participant lists.`
            : ''),
      };
    }
    case 'cleared':
      return { tone: 'ok', text: 'The Slido results were removed from the report.' };
    case 'no-file':
      return { tone: 'problem', text: 'Choose the Slido Excel file first.' };
    case 'not-xlsx':
      return {
        tone: 'problem',
        text: 'That is not an .xlsx file. In Slido, export to Excel, not CSV.',
      };
    case 'too-big':
      return {
        tone: 'problem',
        text: 'That file is over 5 MB, which is far bigger than a Slido export.',
      };
    case 'unreadable':
      return {
        tone: 'problem',
        text: 'That file could not be read. Open it in Excel, save it again as .xlsx, and retry.',
      };
    case 'nothing-found':
      return {
        tone: 'problem',
        text: 'No polls or questions were found in that file. Check it is the Slido results export.',
      };
    case 'too-many':
      return {
        tone: 'problem',
        text: 'Too many uploads in a row. Wait a few minutes and try again.',
      };
    case 'failed':
      return { tone: 'problem', text: 'Something went wrong reading that file. Try again.' };
    default:
      return null;
  }
}
