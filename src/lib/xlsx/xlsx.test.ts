import { describe, expect, it } from 'vitest';

import { readXlsx } from './read';
import { columnLetters, escapeXml, safeSheetNames, writeXlsx } from './write';
import { crc32, readZip, writeZip, ZipError } from './zip';

describe('zip', () => {
  it('computes the standard crc32', () => {
    expect(crc32(Buffer.from('123456789'))).toBe(0xcbf43926);
  });

  it('round trips files', () => {
    const zip = writeZip([
      { name: 'a.txt', data: Buffer.from('hello') },
      { name: 'dir/b.txt', data: Buffer.from('world '.repeat(500)) },
    ]);
    const files = readZip(zip);
    expect(files.get('a.txt')?.toString()).toBe('hello');
    expect(files.get('dir/b.txt')?.toString()).toBe('world '.repeat(500));
  });

  it('round trips a stored entry, as used for photos', () => {
    const data = Buffer.from([0xff, 0xd8, 0xff, 1, 2, 3]);
    const files = readZip(writeZip([{ name: 'a.jpg', data, store: true }]));
    expect(files.get('a.jpg')).toEqual(data);
  });

  it('refuses something that is not a zip', () => {
    expect(() => readZip(Buffer.from('not a zip file at all, just text'))).toThrow(ZipError);
  });

  it('refuses a file that unpacks to too much', () => {
    const zip = writeZip([{ name: 'big.txt', data: Buffer.alloc(2_000_000, 65) }]);
    expect(() => readZip(zip, { maxTotalBytes: 1_000_000 })).toThrow(ZipError);
  });
});

describe('writing xlsx', () => {
  it('names columns like Excel', () => {
    expect([0, 25, 26, 27, 701, 702].map(columnLetters)).toEqual([
      'A',
      'Z',
      'AA',
      'AB',
      'ZZ',
      'AAA',
    ]);
  });

  it('escapes text and drops characters XML cannot hold', () => {
    expect(escapeXml('<b>"Tom" & Jerry</b>\u0001')).toBe(
      '&lt;b&gt;&quot;Tom&quot; &amp; Jerry&lt;/b&gt;',
    );
  });

  it('keeps sheet names inside Excel rules', () => {
    expect(safeSheetNames(['Polls', 'polls', 'a/b?c', 'x'.repeat(40), ''])).toEqual([
      'Polls',
      'polls (2)',
      'a b c',
      'x'.repeat(31),
      'Sheet',
    ]);
  });

  it('round trips text, numbers, blanks and awkward characters', () => {
    const file = writeXlsx([
      {
        name: 'People',
        rows: [
          ['Name', 'Score', 'Note'],
          ['Aina & Co', 4.5, '=SUM(A1:A9)'],
          ['Line one\nline two', null, '<script>'],
        ],
      },
      { name: 'Empty', rows: [['Only a header']] },
    ]);
    const sheets = readXlsx(file);
    expect(sheets.map((s) => s.name)).toEqual(['People', 'Empty']);
    expect(sheets[0]?.rows).toEqual([
      ['Name', 'Score', 'Note'],
      ['Aina & Co', '4.5', '=SUM(A1:A9)'],
      ['Line one\nline two', '', '<script>'],
    ]);
  });

  it('never writes a formula, so "=" text stays text', () => {
    const file = writeXlsx([{ name: 'S', rows: [['h'], ['=1+1']] }]);
    const sheet = readZip(file).get('xl/worksheets/sheet1.xml')?.toString() ?? '';
    expect(sheet).not.toContain('<f>');
    expect(sheet).toContain('t="inlineStr"');
  });
});

describe('reading xlsx written by Excel', () => {
  /** Shaped like a real Excel file: shared strings, absolute targets, gaps. */
  function excelStyle(): Buffer {
    const t = (s: string) => Buffer.from(s, 'utf8');
    return writeZip([
      {
        name: 'xl/workbook.xml',
        data: t(
          '<workbook xmlns:r="r"><sheets><sheet name="Polls &amp; votes" sheetId="1" r:id="rId3"/></sheets></workbook>',
        ),
      },
      {
        name: 'xl/_rels/workbook.xml.rels',
        data: t(
          '<Relationships><Relationship Id="rId3" Target="/xl/worksheets/sheet7.xml"/></Relationships>',
        ),
      },
      {
        name: 'xl/sharedStrings.xml',
        data: t(
          '<sst><si><t>Option</t></si><si><r><t>Ye</t></r><r><t xml:space="preserve">s </t></r></si><si><t>Votes</t></si></sst>',
        ),
      },
      {
        name: 'xl/worksheets/sheet7.xml',
        data: t(
          '<worksheet><sheetData>' +
            '<row r="1"><c r="A1" t="s"><v>0</v></c><c r="C1" t="s"><v>2</v></c></row>' +
            '<row r="3"><c r="A3" t="s"><v>1</v></c><c r="C3"><v>42</v></c><c r="D3" t="b"><v>1</v></c></row>' +
            '</sheetData></worksheet>',
        ),
      },
    ]);
  }

  it('reads shared strings, rich text, gaps and booleans', () => {
    const [sheet] = readXlsx(excelStyle());
    expect(sheet?.name).toBe('Polls & votes');
    expect(sheet?.rows).toEqual([['Option', '', 'Votes'], [], ['Yes ', '', '42', 'TRUE']]);
  });

  it('respects the row and column limits', () => {
    const [sheet] = readXlsx(excelStyle(), { maxRows: 1, maxColumns: 1 });
    expect(sheet?.rows).toEqual([['Option']]);
  });
});
