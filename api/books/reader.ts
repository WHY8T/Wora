/**
 * In-app reader for public-domain books only.
 *
 * We only ever serve full book text for Project Gutenberg titles (source "gutendex" /
 * externalId "gut:<id>"), which are confirmed public domain and freely redistributable.
 * Every other source (Google Books, the local curated catalog) is copyrighted — for those
 * we only ever link out to the publisher's own official preview, never embed text here.
 */

const PAGE_SIZE = 2400; // characters per page, paragraph-aligned

type CachedBook = {
  title: string;
  pages: string[];
};

const bookCache = new Map<string, CachedBook>();

function stripBoilerplate(raw: string): string {
  const startMatch = raw.match(/\*\*\*\s*START OF (?:THE|THIS) PROJECT GUTENBERG EBOOK[^\n]*\*\*\*/i);
  const endMatch = raw.match(/\*\*\*\s*END OF (?:THE|THIS) PROJECT GUTENBERG EBOOK[^\n]*\*\*\*/i);

  let text = raw;
  if (startMatch && typeof startMatch.index === "number") {
    text = raw.slice(startMatch.index + startMatch[0].length);
  }
  if (endMatch) {
    const endIdx = text.indexOf(endMatch[0]);
    if (endIdx !== -1) text = text.slice(0, endIdx);
  }
  return text.trim();
}

function paginate(text: string, pageSize: number): string[] {
  const paragraphs = text.split(/\n\s*\n/).filter((p) => p.trim().length > 0);
  const pages: string[] = [];
  let current = "";

  for (const para of paragraphs) {
    const candidate = current ? `${current}\n\n${para}` : para;
    if (candidate.length > pageSize && current) {
      pages.push(current.trim());
      current = para;
    } else {
      current = candidate;
    }
  }
  if (current.trim()) pages.push(current.trim());
  return pages.length > 0 ? pages : [text.trim()];
}

async function loadGutenbergBook(gutId: string): Promise<CachedBook> {
  const cached = bookCache.get(gutId);
  if (cached) return cached;

  const metaRes = await fetch(`https://gutendex.com/books/${encodeURIComponent(gutId)}`, {
    signal: AbortSignal.timeout(10000),
  });
  if (!metaRes.ok) throw new Error("Could not find this book on Project Gutenberg.");
  const meta = (await metaRes.json()) as {
    title?: string;
    formats?: Record<string, string>;
  };

  const formats: Record<string, string> = meta.formats ?? {};
  const textUrl =
    formats["text/plain; charset=utf-8"] ??
    formats["text/plain; charset=us-ascii"] ??
    formats["text/plain"] ??
    Object.entries(formats).find(([mime]) => mime.startsWith("text/plain"))?.[1];

  if (!textUrl) {
    throw new Error("This book doesn't have a plain-text edition available to read.");
  }

  const textRes = await fetch(textUrl, { signal: AbortSignal.timeout(20000) });
  if (!textRes.ok) throw new Error("Could not download this book's text.");
  const raw = await textRes.text();

  const cleaned = stripBoilerplate(raw);
  const pages = paginate(cleaned, PAGE_SIZE);
  const entry: CachedBook = { title: meta.title ?? "Untitled", pages };
  bookCache.set(gutId, entry);
  return entry;
}

export async function getReaderPage(externalId: string, pageIndex: number) {
  if (!externalId.startsWith("gut:")) {
    throw new Error(
      "In-app reading is only available for public-domain books (the ones with a \"Read free online\" button).",
    );
  }
  const gutId = externalId.slice("gut:".length);
  const book = await loadGutenbergBook(gutId);
  const clamped = Math.min(Math.max(pageIndex, 0), book.pages.length - 1);
  return {
    title: book.title,
    page: clamped,
    totalPages: book.pages.length,
    content: book.pages[clamped] ?? "",
  };
}
