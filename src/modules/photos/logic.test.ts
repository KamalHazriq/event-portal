import { describe, expect, it } from 'vitest';

import { checkUpload, fitWithin, jpegSize, PHOTO_LIMITS, uploadMessage, zipName } from './logic';

/** The smallest valid looking JPEG header: SOI, an APP0, then a baseline SOF0. */
function fakeJpeg(width: number, height: number, padTo = 0): Uint8Array {
  const app0 = [0xff, 0xe0, 0x00, 0x10, ...new Array(14).fill(0)];
  const sof0 = [
    0xff,
    0xc0,
    0x00,
    0x11,
    0x08,
    (height >> 8) & 0xff,
    height & 0xff,
    (width >> 8) & 0xff,
    width & 0xff,
    0x03,
    ...new Array(9).fill(0),
  ];
  const bytes = [0xff, 0xd8, ...app0, ...sof0, 0xff, 0xd9];
  while (bytes.length < padTo) bytes.push(0);
  return new Uint8Array(bytes);
}

describe('reading a JPEG header', () => {
  it('finds the size', () => {
    expect(jpegSize(fakeJpeg(1600, 1200))).toEqual({ width: 1600, height: 1200 });
  });

  it('refuses things that are not JPEGs', () => {
    expect(jpegSize(new TextEncoder().encode('<svg onload=alert(1)>'))).toBeNull();
    expect(jpegSize(new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0, 0, 0, 0, 0, 0, 0, 0]))).toBeNull();
    expect(jpegSize(new Uint8Array([0xff, 0xd8, 0xff]))).toBeNull();
  });

  it('refuses a JPEG start with garbage after it', () => {
    expect(jpegSize(new Uint8Array([0xff, 0xd8, 0x00, 0x00, 1, 2, 3, 4, 5, 6, 7, 8]))).toBeNull();
  });
});

describe('checking an upload', () => {
  const thumb = fakeJpeg(480, 360);

  it('accepts a shrunk photo', () => {
    expect(checkUpload({ image: fakeJpeg(1600, 1200), thumbnail: thumb, alreadySent: 3 })).toEqual({
      ok: true,
      width: 1600,
      height: 1200,
    });
  });

  it('stops a phone at its allowance', () => {
    const result = checkUpload({
      image: fakeJpeg(1600, 1200),
      thumbnail: thumb,
      alreadySent: PHOTO_LIMITS.perDevice,
    });
    expect(result).toEqual({ ok: false, problem: 'too-many' });
  });

  it('refuses a photo that was not shrunk, or is too heavy', () => {
    expect(checkUpload({ image: fakeJpeg(4000, 3000), thumbnail: thumb, alreadySent: 0 })).toEqual({
      ok: false,
      problem: 'too-big',
    });
    const heavy = fakeJpeg(1600, 1200, PHOTO_LIMITS.maxImageBytes + 1);
    expect(checkUpload({ image: heavy, thumbnail: thumb, alreadySent: 0 })).toEqual({
      ok: false,
      problem: 'too-big',
    });
  });

  it('refuses a file pretending to be a photo', () => {
    const fake = new TextEncoder().encode('<html>not a photo</html>');
    expect(checkUpload({ image: fake, thumbnail: thumb, alreadySent: 0 })).toEqual({
      ok: false,
      problem: 'not-a-photo',
    });
  });

  it('explains every refusal in plain words', () => {
    for (const p of [
      'not-a-photo',
      'too-big',
      'too-many',
      'switched-off',
      'rate-limited',
      'failed',
    ] as const) {
      expect(uploadMessage(p).length).toBeGreaterThan(10);
    }
  });
});

describe('sizes and names', () => {
  it('fits the longest side and never enlarges', () => {
    expect(fitWithin(4000, 3000, 1600)).toEqual({ width: 1600, height: 1200 });
    expect(fitWithin(3000, 4000, 1600)).toEqual({ width: 1200, height: 1600 });
    expect(fitWithin(800, 600, 1600)).toEqual({ width: 800, height: 600 });
  });

  it('numbers the zip files', () => {
    expect([zipName(0), zipName(41)]).toEqual(['photo-001.jpg', 'photo-042.jpg']);
  });
});
