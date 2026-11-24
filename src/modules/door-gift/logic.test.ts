import { describe, expect, it } from 'vitest';

import {
  DEFAULT_GIFTS,
  giftImageData,
  givenCounts,
  parseDoorGiftConfig,
  pickGift,
  safeImage,
  spinOpen,
} from './logic';

const items = [
  { id: 'a', name: 'A', stock: 2, image: '' },
  { id: 'b', name: 'B', stock: 1, image: '' },
];

describe('door gifts', () => {
  it('never hands out a gift that has run out', () => {
    const given = new Map([['a', 2]]);
    for (let i = 0; i < 20; i += 1) expect(pickGift(items, given, Math.random)?.id).toBe('b');
  });

  it('follows how many are left', () => {
    // 3 left in all: a roll under 2/3 lands on A, above it on B.
    expect(pickGift(items, new Map(), () => 0.1)?.id).toBe('a');
    expect(pickGift(items, new Map(), () => 0.9)?.id).toBe('b');
  });

  it('says so when everything has gone', () => {
    expect(
      pickGift(
        items,
        new Map([
          ['a', 2],
          ['b', 1],
        ]),
      ),
    ).toBeNull();
  });

  it('counts what was given', () => {
    const counts = givenCounts([
      { item: 'a', at: '', by: 'spin', collected: false },
      { item: 'a', at: '', by: 'spin', collected: true },
    ]);
    expect(counts.get('a')).toBe(2);
  });

  it('reads settings safely, with the three gifts by default', () => {
    expect(parseDoorGiftConfig(null).items).toEqual(DEFAULT_GIFTS);
    expect(parseDoorGiftConfig('nope').mode).toBe('first-day');
    expect(
      parseDoorGiftConfig(
        JSON.stringify({ mode: 'on', items: [{ id: 'x', name: 'X', stock: -3 }] }),
      ).items[0]?.stock,
    ).toBe(0);
  });

  it('opens only when it should', () => {
    expect(spinOpen('first-day', true)).toBe(true);
    expect(spinOpen('first-day', false)).toBe(false);
    expect(spinOpen('on', false)).toBe(true);
    expect(spinOpen('off', true)).toBe(false);
  });

  it('takes an uploaded photo, and nothing else, as a picture', () => {
    expect(safeImage('/api/door-gift/image/massager?v=123')).toBe(
      '/api/door-gift/image/massager?v=123',
    );
    expect(giftImageData('data:image/jpeg;base64,AAAA')).toBe('data:image/jpeg;base64,AAAA');
    expect(giftImageData('data:text/html;base64,AAAA')).toBeNull();
    expect(giftImageData('javascript:alert(1)')).toBeNull();
  });

  it('only keeps safe picture addresses', () => {
    expect(safeImage('/door-gifts/a.svg')).toBe('/door-gifts/a.svg');
    expect(safeImage('https://x.example/a.png')).toBe('https://x.example/a.png');
    expect(safeImage('javascript:alert(1)')).toBe('');
  });
});
