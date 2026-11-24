import { afterEach, describe, expect, it } from 'vitest';

import {
  cachedImage,
  forgetImages,
  IMAGE_CACHE_BYTES,
  IMAGE_TTL_MS,
  keepImage,
} from './image-cache';

afterEach(() => forgetImages());

describe('the photo cache', () => {
  it('keeps a photo for five minutes, then reads it again', () => {
    keepImage('a', 'thumb', new Uint8Array([1, 2, 3]), 0);
    expect(cachedImage('a', 'thumb', IMAGE_TTL_MS - 1)).toEqual(new Uint8Array([1, 2, 3]));
    expect(cachedImage('a', 'thumb', IMAGE_TTL_MS)).toBeNull();
  });

  it('forgets a rejected photo at once', () => {
    keepImage('a', 'thumb', new Uint8Array([1]), 0);
    keepImage('a', 'full', new Uint8Array([1]), 0);
    forgetImages(['a']);
    expect(cachedImage('a', 'thumb', 1)).toBeNull();
    expect(cachedImage('a', 'full', 1)).toBeNull();
  });

  it('drops the oldest when it is full', () => {
    const big = IMAGE_CACHE_BYTES / 8 - 1;
    for (let i = 0; i < 9; i += 1) keepImage(`p${i}`, 'full', new Uint8Array(big), 0);
    expect(cachedImage('p0', 'full', 1)).toBeNull();
    expect(cachedImage('p8', 'full', 1)).not.toBeNull();
  });
});
