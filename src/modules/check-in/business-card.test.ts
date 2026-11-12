import { describe, expect, it } from 'vitest';

import {
  looksLikeBusinessCard,
  matchBusinessCard,
  nameSimilarity,
  nameTokens,
  parseBusinessCard,
} from './business-card';

/** Shaped like the TNB app's card. Every detail is invented. */
const TNB_CARD = [
  'BEGIN:VCARD',
  'VERSION:3.0',
  'N:;Aiman Hakim bin Mohd Rafi;;;',
  'TEL;TYPE=cell,msg:0120000000',
  'EMAIL;TYPE=internet:AIMAN.RAFI@EXAMPLE.COM',
  'ADR;TYPE=work:;;Level 1\\, Tower Z\\, No. 1\\, Jalan Contoh;Kuala Lumpur;WKL;50000;MY',
  'ORG:Example Berhad;Digital Division',
  'TITLE:Executive',
  'END:VCARD',
].join('\n');

describe('reading a business card', () => {
  it('reads the name and email from the TNB style card, and nothing else', () => {
    expect(parseBusinessCard(TNB_CARD)).toEqual({
      name: 'Aiman Hakim bin Mohd Rafi',
      email: 'aiman.rafi@example.com',
    });
  });

  it('prefers FN, handles CRLF, folded lines and grouped properties', () => {
    const card = [
      'BEGIN:VCARD',
      'VERSION:4.0',
      'N:Lim;Wei;;;',
      'FN:Lim Wei',
      ' Ling',
      'item1.EMAIL:lim@example.com',
      'END:VCARD',
    ].join('\r\n');
    expect(parseBusinessCard(card)).toEqual({ name: 'Lim WeiLing', email: 'lim@example.com' });
  });

  it('puts given names first when the card splits N', () => {
    const card = 'BEGIN:VCARD\nN:Singh;Ranjit;;;\nEND:VCARD';
    expect(parseBusinessCard(card)?.name).toBe('Ranjit Singh');
  });

  it('reads MECARD too', () => {
    expect(parseBusinessCard('MECARD:N:Tan,Mei Ling;EMAIL:mei@example.com;;')).toEqual({
      name: 'Mei Ling Tan',
      email: 'mei@example.com',
    });
  });

  it('drops an email that is not one', () => {
    expect(parseBusinessCard('BEGIN:VCARD\nFN:A B\nEMAIL:nope\nEND:VCARD')?.email).toBe('');
  });

  it('is not fooled by a name tag link or a token', () => {
    expect(parseBusinessCard('https://portal.example.com/c/abcdefghijklmnop')).toBeNull();
    expect(looksLikeBusinessCard('abcdefghijklmnop')).toBe(false);
    expect(looksLikeBusinessCard(TNB_CARD)).toBe(true);
    expect(parseBusinessCard('BEGIN:VCARD\nEND:VCARD')).toBeNull();
  });
});

describe('comparing names', () => {
  it('ignores titles, connectors, case and punctuation', () => {
    expect(nameTokens('Ir. Shri Rajini Kanth A/L Kanaesalingam')).toEqual([
      'shri',
      'rajini',
      'kanth',
      'kanaesalingam',
    ]);
    expect(nameTokens('Tun Abdul Karim Tun Abu Bakar, Ts.')).toEqual([
      'tun',
      'abdul',
      'karim',
      'tun',
      'abu',
      'bakar',
    ]);
  });

  it('treats the spellings of Muhammad and Abdul as one', () => {
    expect(nameTokens('Mohd Zaidi bin Che Mat @ Abd Hamid').join(' ')).toBe(
      nameTokens('Muhammad Zaidi Che Mat Abdul Hamid').join(' '),
    );
  });

  it('scores shared words', () => {
    expect(nameSimilarity('Nur Aina binti Ali', 'Nur Aina Ali')).toBe(1);
    expect(nameSimilarity('Nur Aina binti Ali', 'Nur Aina binti Abu')).toBeCloseTo(2 / 3);
    expect(nameSimilarity('A', '')).toBe(0);
  });
});

describe('matching a card to the list', () => {
  const people = [
    { id: '1', name: 'Aiman Hakim Bin Mohamad Rafi', email: '' },
    { id: '2', name: 'Nur Aina binti Ali', email: 'aina@example.com' },
    { id: '3', name: 'Nur Aina binti Abu', email: '' },
    { id: '4', name: 'Lee Chong Wei', email: '' },
  ];

  it('matches on email first', () => {
    expect(matchBusinessCard({ name: 'Someone Else', email: 'aina@example.com' }, people)).toEqual({
      kind: 'match',
      attendee: people[1],
      by: 'email',
    });
  });

  it('matches an exact name, however it is spelled', () => {
    const card = parseBusinessCard(TNB_CARD);
    expect(card && matchBusinessCard(card, people)).toEqual({
      kind: 'match',
      attendee: people[0],
      by: 'name',
    });
  });

  it('asks the desk when the name is only close', () => {
    const result = matchBusinessCard({ name: 'Nur Aina', email: '' }, people);
    expect(result.kind).toBe('choose');
    if (result.kind === 'choose') {
      expect(result.candidates.map((p) => p.id).sort()).toEqual(['2', '3']);
    }
  });

  it('says so when nobody is close', () => {
    expect(matchBusinessCard({ name: 'Somebody New', email: '' }, people)).toEqual({
      kind: 'none',
    });
    expect(matchBusinessCard({ name: '', email: 'x@example.com' }, people)).toEqual({
      kind: 'none',
    });
  });

  it('never auto picks between two people with the same name', () => {
    const twins = [
      { id: 'a', name: 'Lee Chong Wei' },
      { id: 'b', name: 'LEE CHONG WEI' },
    ];
    expect(matchBusinessCard({ name: 'Lee Chong Wei', email: '' }, twins).kind).toBe('choose');
  });
});
