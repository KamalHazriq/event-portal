/**
 * Just enough of the zip format to write and read .xlsx files.
 *
 * An .xlsx file is a zip of XML files. Node already has the compression
 * (zlib's raw deflate), so the only thing missing is the zip container, which
 * is a few fixed binary headers. Writing it here keeps the portal free of an
 * Excel library, per the brief's "keep dependencies minimal".
 *
 * Supports what Excel and Slido produce: stored and deflated entries, no
 * encryption, no zip64. Anything else is refused with a plain error.
 */
import { deflateRawSync, inflateRawSync } from 'node:zlib';

/* ------------------------------------------------------------------ crc32 */

const CRC_TABLE = (() => {
  const table = new Uint32Array(256);
  for (let n = 0; n < 256; n += 1) {
    let c = n;
    for (let k = 0; k < 8; k += 1) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    table[n] = c >>> 0;
  }
  return table;
})();

export function crc32(data: Uint8Array): number {
  let crc = 0xffffffff;
  for (let i = 0; i < data.length; i += 1) {
    crc = (CRC_TABLE[(crc ^ (data[i] as number)) & 0xff] as number) ^ (crc >>> 8);
  }
  return (crc ^ 0xffffffff) >>> 0;
}

/* ----------------------------------------------------------------- writing */

export type ZipEntry = { name: string; data: Buffer };

/** 1 Jan 2026, 00:00, in the DOS format zip uses. A fixed date keeps files reproducible. */
const DOS_TIME = 0;
const DOS_DATE = ((2026 - 1980) << 9) | (1 << 5) | 1;

export function writeZip(entries: ZipEntry[]): Buffer {
  const locals: Buffer[] = [];
  const centrals: Buffer[] = [];
  let offset = 0;

  for (const entry of entries) {
    const name = Buffer.from(entry.name, 'utf8');
    const compressed = deflateRawSync(entry.data);
    const crc = crc32(entry.data);

    const local = Buffer.alloc(30);
    local.writeUInt32LE(0x04034b50, 0);
    local.writeUInt16LE(20, 4); // version needed
    local.writeUInt16LE(0x0800, 6); // UTF-8 names
    local.writeUInt16LE(8, 8); // deflate
    local.writeUInt16LE(DOS_TIME, 10);
    local.writeUInt16LE(DOS_DATE, 12);
    local.writeUInt32LE(crc, 14);
    local.writeUInt32LE(compressed.length, 18);
    local.writeUInt32LE(entry.data.length, 22);
    local.writeUInt16LE(name.length, 26);
    local.writeUInt16LE(0, 28);
    locals.push(local, name, compressed);

    const central = Buffer.alloc(46);
    central.writeUInt32LE(0x02014b50, 0);
    central.writeUInt16LE(20, 4); // version made by
    central.writeUInt16LE(20, 6);
    central.writeUInt16LE(0x0800, 8);
    central.writeUInt16LE(8, 10);
    central.writeUInt16LE(DOS_TIME, 12);
    central.writeUInt16LE(DOS_DATE, 14);
    central.writeUInt32LE(crc, 16);
    central.writeUInt32LE(compressed.length, 20);
    central.writeUInt32LE(entry.data.length, 24);
    central.writeUInt16LE(name.length, 28);
    central.writeUInt32LE(offset, 42);
    centrals.push(central, name);

    offset += local.length + name.length + compressed.length;
  }

  const centralSize = centrals.reduce((sum, b) => sum + b.length, 0);
  const end = Buffer.alloc(22);
  end.writeUInt32LE(0x06054b50, 0);
  end.writeUInt16LE(entries.length, 8);
  end.writeUInt16LE(entries.length, 10);
  end.writeUInt32LE(centralSize, 12);
  end.writeUInt32LE(offset, 16);

  return Buffer.concat([...locals, ...centrals, end]);
}

/* ----------------------------------------------------------------- reading */

export class ZipError extends Error {}

export type ReadZipOptions = {
  /** Refuse the file once the unpacked total passes this. Guards against zip bombs. */
  maxTotalBytes?: number;
  /** Only unpack entries this returns true for. */
  include?: (name: string) => boolean;
};

export function readZip(file: Buffer, options: ReadZipOptions = {}): Map<string, Buffer> {
  const maxTotal = options.maxTotalBytes ?? 50 * 1024 * 1024;

  // The end of central directory record sits in the last 64 KB + 22 bytes.
  let end = -1;
  for (let i = file.length - 22; i >= Math.max(0, file.length - 22 - 0xffff); i -= 1) {
    if (file.readUInt32LE(i) === 0x06054b50) {
      end = i;
      break;
    }
  }
  if (end < 0) throw new ZipError('This is not an Excel file, or it is damaged.');

  const count = file.readUInt16LE(end + 10);
  let pointer = file.readUInt32LE(end + 16);
  if (count === 0xffff || pointer === 0xffffffff) {
    throw new ZipError('This file is too large to read. Save it again from Excel and retry.');
  }

  const out = new Map<string, Buffer>();
  let total = 0;

  for (let n = 0; n < count; n += 1) {
    if (pointer + 46 > file.length || file.readUInt32LE(pointer) !== 0x02014b50) {
      throw new ZipError('This Excel file is damaged.');
    }
    const flags = file.readUInt16LE(pointer + 8);
    const method = file.readUInt16LE(pointer + 10);
    const compressedSize = file.readUInt32LE(pointer + 20);
    const size = file.readUInt32LE(pointer + 24);
    const nameLength = file.readUInt16LE(pointer + 28);
    const extraLength = file.readUInt16LE(pointer + 30);
    const commentLength = file.readUInt16LE(pointer + 32);
    const localOffset = file.readUInt32LE(pointer + 42);
    const name = file.toString('utf8', pointer + 46, pointer + 46 + nameLength);
    pointer += 46 + nameLength + extraLength + commentLength;

    if (name.endsWith('/')) continue;
    if (options.include && !options.include(name)) continue;
    if (flags & 0x1)
      throw new ZipError('This file is password protected. Save it without a password.');

    if (localOffset + 30 > file.length || file.readUInt32LE(localOffset) !== 0x04034b50) {
      throw new ZipError('This Excel file is damaged.');
    }
    const dataStart =
      localOffset + 30 + file.readUInt16LE(localOffset + 26) + file.readUInt16LE(localOffset + 28);
    const raw = file.subarray(dataStart, dataStart + compressedSize);

    total += size;
    if (total > maxTotal) throw new ZipError('This file unpacks to more than the portal accepts.');

    let data: Buffer;
    if (method === 0) data = Buffer.from(raw);
    else if (method === 8) {
      try {
        // Cap the output too, in case the size in the header is a lie.
        data = inflateRawSync(raw, { maxOutputLength: Math.max(size, 1) + 1024 });
      } catch {
        throw new ZipError('This Excel file is damaged.');
      }
    } else throw new ZipError('This file uses a compression the portal cannot read.');

    out.set(name, data);
  }

  return out;
}
