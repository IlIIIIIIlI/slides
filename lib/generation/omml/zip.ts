// Minimal ZIP reader for extracting entries from DOCX/PPTX archives.
// Uses only Node.js built-ins: zlib for DEFLATE decompression.
// Reads the central directory (at the end of the ZIP) for reliable offsets.

import { inflateRaw } from "node:zlib";

const EOCD_SIG = 0x06054b50;
const CD_SIG = 0x02014b50;

function findEOCD(buf: Buffer): number {
  // EOCD is at most 65535 bytes from end of file. Search backwards.
  const start = Math.max(0, buf.length - 22 - 65535);
  for (let i = buf.length - 22; i >= start; i--) {
    if (buf.readUInt32LE(i) === EOCD_SIG) return i;
  }
  return -1;
}

async function inflateBuffer(data: Buffer): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    inflateRaw(data, (err, result) => (err ? reject(err) : resolve(result)));
  });
}

/**
 * Read ZIP entries matching `filter(name)` from `buf`.
 * Returns a Map of filename → decompressed content.
 * Supports STORE (method 0) and DEFLATE (method 8).
 */
export async function readZipEntries(
  buf: Buffer,
  filter: (name: string) => boolean,
): Promise<Map<string, Buffer>> {
  const result = new Map<string, Buffer>();
  const eocd = findEOCD(buf);
  if (eocd < 0) return result;

  const cdOffset = buf.readUInt32LE(eocd + 16);
  const cdSize = buf.readUInt32LE(eocd + 12);
  let pos = cdOffset;

  while (pos + 46 <= cdOffset + cdSize) {
    if (buf.readUInt32LE(pos) !== CD_SIG) break;

    const method = buf.readUInt16LE(pos + 10);
    const compSize = buf.readUInt32LE(pos + 20);
    const nameLen = buf.readUInt16LE(pos + 28);
    const extraLen = buf.readUInt16LE(pos + 30);
    const commentLen = buf.readUInt16LE(pos + 32);
    const lfhOffset = buf.readUInt32LE(pos + 42);
    const name = buf.subarray(pos + 46, pos + 46 + nameLen).toString("utf8");

    pos += 46 + nameLen + extraLen + commentLen;

    if (!filter(name)) continue;

    // Local file header: skip to data (name length at +26, extra at +28)
    const lfhNameLen = buf.readUInt16LE(lfhOffset + 26);
    const lfhExtraLen = buf.readUInt16LE(lfhOffset + 28);
    const dataStart = lfhOffset + 30 + lfhNameLen + lfhExtraLen;
    const compressed = buf.subarray(dataStart, dataStart + compSize);

    if (method === 0) {
      result.set(name, Buffer.from(compressed));
    } else if (method === 8) {
      result.set(name, await inflateBuffer(compressed));
    }
    // Skip unsupported compression methods silently
  }

  return result;
}
