import fs from "fs/promises";
import path from "path";

const PUBLIC_EXTRACTED = path.join(process.cwd(), "public", "extracted");

interface CacheMeta {
  sha256: string;
  pages: number;
  createdAt: string;
}

export async function readPageCache(deckId: string, sha256: string): Promise<Buffer[] | null> {
  try {
    const dir = path.join(PUBLIC_EXTRACTED, deckId);
    const metaRaw = await fs.readFile(path.join(dir, "meta.json"), "utf-8");
    const meta: CacheMeta = JSON.parse(metaRaw);
    if (meta.sha256 !== sha256) return null;

    const buffers: Buffer[] = [];
    for (let n = 1; n <= meta.pages; n++) {
      const buf = await fs.readFile(path.join(dir, `page-${n}.png`));
      buffers.push(buf);
    }
    return buffers;
  } catch {
    return null;
  }
}

export async function writePageCache(
  deckId: string,
  sha256: string,
  buffers: Buffer[],
): Promise<void> {
  const dir = path.join(PUBLIC_EXTRACTED, deckId);
  await fs.mkdir(dir, { recursive: true });

  for (let i = 0; i < buffers.length; i++) {
    await fs.writeFile(path.join(dir, `page-${i + 1}.png`), buffers[i]);
  }

  const meta: CacheMeta = {
    sha256,
    pages: buffers.length,
    createdAt: new Date().toISOString(),
  };
  await fs.writeFile(path.join(dir, "meta.json"), JSON.stringify(meta, null, 2), "utf-8");
}
