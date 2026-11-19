import { describe, expect, it } from 'vitest';

import { parseFavourites, toggleFavourite } from './favourites';

describe('favourites', () => {
  it('reads only a list of short ids, once each', () => {
    expect(parseFavourites(null)).toEqual([]);
    expect(parseFavourites('not json')).toEqual([]);
    expect(parseFavourites('{"a":1}')).toEqual([]);
    expect(parseFavourites('["a","b","a",3,"' + 'x'.repeat(81) + '"]')).toEqual(['a', 'b']);
  });

  it('toggles a session on and off', () => {
    expect(toggleFavourite(['a'], 'b')).toEqual(['a', 'b']);
    expect(toggleFavourite(['a', 'b'], 'a')).toEqual(['b']);
  });
});
