export type * from "../db/schema";
export * from "./errors";

/** Normalized book shape used across the provider chain (Google Books / Gutendex / local catalog). */
export type BookSummary = {
  externalId: string;
  source: "google" | "gutendex" | "local";
  title: string;
  authors: string[];
  cover: string | null;
  description: string;
  categories: string[];
  pageCount: number | null;
  publishedDate: string | null;
  isbn: string | null;
  /** External rating (e.g. Google averageRating), 0-5 */
  externalRating: number | null;
  externalRatingsCount: number;
  /** Editorial trending weight (local catalog only) */
  trendingScore?: number;
  /** Link to read the book, when a legitimate free/preview source exists (Gutenberg full text, Google Books preview) */
  readUrl: string | null;
};

export type BookSearchResult = {
  items: BookSummary[];
  provider: string;
  totalEstimate: number;
};
