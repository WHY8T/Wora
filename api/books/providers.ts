import type { BookSummary, BookSearchResult } from "@contracts/types";
import { searchCatalog, trendingCatalog, catalogById } from "./catalog";

/**
 * Books provider chain.
 *
 * 1. Google Books (primary, huge catalog) — skipped automatically when it
 *    errors or the runtime cannot reach googleapis.com (short timeout).
 * 2. Open Library (fallback, huge catalog, no API key, very reliable —
 *    run by the Internet Archive).
 * 3. Gutendex / Project Gutenberg (fallback, always-on public-domain classics).
 * 4. Local curated catalog (always merged in for popular titles).
 */

const TIMEOUT_MS = 12000;

async function getJson(url: string, retries = 2): Promise<any> {
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      const res = await fetch(url, { signal: AbortSignal.timeout(TIMEOUT_MS) });
      if (!res.ok) {
        const transient = res.status === 429 || res.status >= 500;
        const bodySnippet = await res.text().then((t) => t.slice(0, 200)).catch(() => "");
        if (transient && attempt < retries) {
          await new Promise((r) => setTimeout(r, 400 * (attempt + 1)));
          continue;
        }
        throw new Error(`books provider HTTP ${res.status}${bodySnippet ? `: ${bodySnippet}` : ""}`);
      }
      return res.json();
    } catch (err) {
      if (attempt < retries && err instanceof Error && !err.message.startsWith("books provider HTTP")) {
        await new Promise((r) => setTimeout(r, 400 * (attempt + 1)));
        continue;
      }
      throw err;
    }
  }
}

function cleanHtml(s: string | undefined | null): string {
  if (!s) return "";
  return s
    .replace(/<[^>]*>/g, " ")
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&apos;/g, "'")
    .replace(/&amp;/g, "&")
    .replace(/\s+/g, " ")
    .trim();
}

function https(url: string | undefined | null): string | null {
  if (!url) return null;
  return url.replace(/^http:\/\//, "https://");
}

/* --------------------------------- Google Books -------------------------------- */

function normalizeGoogle(v: any): BookSummary {
  const vi = v.volumeInfo ?? {};
  const img = vi.imageLinks ?? {};
  const isbn13 = (vi.industryIdentifiers ?? []).find(
    (x: any) => x.type === "ISBN_13" || x.type === "ISBN_10",
  )?.identifier;
  return {
    externalId: String(v.id),
    source: "google",
    title: vi.title ?? "Untitled",
    authors: Array.isArray(vi.authors) ? vi.authors : [],
    cover: https(img.thumbnail ?? img.smallThumbnail ?? img.small),
    description: cleanHtml(vi.description).slice(0, 1200),
    categories: Array.isArray(vi.categories) ? vi.categories.slice(0, 4) : [],
    pageCount: typeof vi.pageCount === "number" ? vi.pageCount : null,
    publishedDate: vi.publishedDate ?? null,
    isbn: isbn13 ?? null,
    externalRating: typeof vi.averageRating === "number" ? vi.averageRating : null,
    externalRatingsCount: typeof vi.ratingsCount === "number" ? vi.ratingsCount : 0,
    readUrl: https(vi.previewLink) ?? null,
  };
}

async function googleSearch(q: string, maxResults = 24, startIndex = 0): Promise<BookSummary[]> {
  const key = process.env.GOOGLE_BOOKS_API_KEY;
  const url = `https://www.googleapis.com/books/v1/volumes?q=${encodeURIComponent(q)}&maxResults=${maxResults}&startIndex=${startIndex}&printType=books&langRestrict=en${key ? `&key=${key}` : ""}`;
  const data = await getJson(url);
  return (data.items ?? []).map(normalizeGoogle);
}

async function googleById(id: string): Promise<BookSummary | null> {
  const key = process.env.GOOGLE_BOOKS_API_KEY;
  const data = await getJson(`https://www.googleapis.com/books/v1/volumes/${encodeURIComponent(id)}${key ? `?key=${key}` : ""}`);
  if (!data?.id) return null;
  return normalizeGoogle(data);
}

/* ----------------------------------- Gutendex ----------------------------------- */

function flipName(name: string): string {
  if (!name.includes(",")) return name;
  const [last, ...rest] = name.split(",");
  return `${rest.join(" ").trim()} ${last.trim()}`.trim();
}

function normalizeGut(b: any): BookSummary {
  const formats = b.formats ?? {};
  const subjects: string[] = Array.isArray(b.subjects) ? b.subjects : [];
  const shelves: string[] = Array.isArray(b.bookshelves) ? b.bookshelves : [];
  const categories = [...shelves, ...subjects]
    .map((s) => s.replace(/^Browsing: /, "").split(" -- ")[0])
    .filter((s) => s.length > 2 && s.length < 40)
    .slice(0, 4);
  return {
    externalId: `gut:${b.id}`,
    source: "gutendex",
    title: b.title ?? "Untitled",
    authors: (b.authors ?? []).map((a: any) => flipName(a.name ?? "")).filter(Boolean),
    cover: https(formats["image/jpeg"]),
    description: cleanHtml((b.summaries ?? [])[0]).slice(0, 900),
    categories,
    pageCount: null,
    publishedDate: null,
    isbn: null,
    externalRating: null,
    externalRatingsCount: typeof b.download_count === "number" ? b.download_count : 0,
    readUrl: `https://www.gutenberg.org/ebooks/${b.id}`,
  };
}

async function gutSearch(q: string): Promise<BookSummary[]> {
  const data = await getJson(`https://gutendex.com/books?search=${encodeURIComponent(q)}`);
  return (data.results ?? []).map(normalizeGut);
}

async function gutById(id: string): Promise<BookSummary | null> {
  const data = await getJson(`https://gutendex.com/books/${encodeURIComponent(id)}`);
  if (!data?.id) return null;
  return normalizeGut(data);
}

async function gutPopular(): Promise<BookSummary[]> {
  const data = await getJson("https://gutendex.com/books?sort=popular");
  return (data.results ?? []).slice(0, 24).map(normalizeGut);
}

/* ----------------------------------- Open Library ----------------------------------- */

function normalizeOpenLibrary(doc: any): BookSummary {
  const workKey: string = doc.key ?? ""; // e.g. "/works/OL12345W"
  const coverId = doc.cover_i;
  return {
    externalId: `ol:${workKey.replace(/^\/works\//, "")}`,
    source: "local",
    title: doc.title ?? "Untitled",
    authors: Array.isArray(doc.author_name) ? doc.author_name : [],
    cover: coverId ? `https://covers.openlibrary.org/b/id/${coverId}-L.jpg` : null,
    description: "",
    categories: Array.isArray(doc.subject) ? doc.subject.slice(0, 4) : [],
    pageCount: typeof doc.number_of_pages_median === "number" ? doc.number_of_pages_median : null,
    publishedDate: doc.first_publish_year ? String(doc.first_publish_year) : null,
    isbn: Array.isArray(doc.isbn) ? doc.isbn[0] : null,
    externalRating: null,
    externalRatingsCount: 0,
    readUrl: null,
  };
}

async function openLibrarySearch(q: string, limit = 20): Promise<BookSummary[]> {
  const data = await getJson(
    `https://openlibrary.org/search.json?q=${encodeURIComponent(q)}&limit=${limit}&fields=key,title,author_name,cover_i,first_publish_year,isbn,subject,number_of_pages_median`,
  );
  return (data.docs ?? []).map(normalizeOpenLibrary);
}

async function openLibraryById(workId: string): Promise<BookSummary | null> {
  const data = await getJson(`https://openlibrary.org/works/${encodeURIComponent(workId)}.json`);
  if (!data?.key) return null;
  return normalizeOpenLibrary({
    key: data.key,
    title: data.title,
    author_name: [],
    cover_i: Array.isArray(data.covers) ? data.covers[0] : undefined,
    subject: data.subjects,
  });
}

/* ----------------------------------- combined ----------------------------------- */

function dedupe(books: BookSummary[]): BookSummary[] {
  const seen = new Set<string>();
  return books.filter((b) => {
    const key = `${b.title.toLowerCase()}|${b.authors[0]?.toLowerCase() ?? ""}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

export async function searchBooks(q: string, startIndex = 0): Promise<BookSearchResult> {
  const local = startIndex === 0 ? searchCatalog(q, 6) : [];
  try {
    const items = await googleSearch(q, 24, startIndex);
    return { items: dedupe([...local, ...items]), provider: "google", totalEstimate: 1000 };
  } catch (err) {
    console.error("[books] Google Books search failed, falling back to Open Library:", err);
  }
  try {
    const items = await openLibrarySearch(q);
    return { items: dedupe([...local, ...items]), provider: "openlibrary", totalEstimate: items.length };
  } catch (err) {
    console.error("[books] Open Library search also failed, falling back to Gutendex:", err);
  }
  try {
    const items = await gutSearch(q);
    return { items: dedupe([...local, ...items]), provider: "gutendex", totalEstimate: items.length };
  } catch (err) {
    console.error("[books] Gutendex search also failed, falling back to local catalog only:", err);
    return { items: local, provider: "local", totalEstimate: local.length };
  }
}

export async function getBookByExternalId(externalId: string): Promise<BookSummary | null> {
  if (externalId.startsWith("local:")) return catalogById(externalId) ?? null;
  if (externalId.startsWith("gut:")) {
    try {
      return await gutById(externalId.slice(4));
    } catch {
      return null;
    }
  }
  if (externalId.startsWith("ol:")) {
    try {
      return await openLibraryById(externalId.slice(3));
    } catch {
      return null;
    }
  }
  try {
    return await googleById(externalId);
  } catch {
    return null;
  }
}

export async function trendingBooks(): Promise<BookSummary[]> {
  const local = trendingCatalog(8);
  try {
    const popular = await gutPopular();
    return dedupe([...local, ...popular]).slice(0, 20);
  } catch {
    return local;
  }
}