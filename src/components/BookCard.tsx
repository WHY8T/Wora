import { Link } from "react-router";
import { BookCover } from "./BookCover";
import { RatingStars } from "./RatingStars";
import { compact } from "@/lib/format";
import type { BookSummary } from "@contracts/types";

export function BookCard({ book }: { book: BookSummary }) {
  return (
    <Link
      to={`/book/${encodeURIComponent(book.externalId)}`}
      className="group flex flex-col gap-2"
    >
      <div className="transition-transform duration-300 group-hover:-translate-y-1">
        <BookCover cover={book.cover} title={book.title} className="w-full shadow-md" />
      </div>
      <div className="min-w-0">
        <p className="truncate text-sm font-medium leading-tight group-hover:text-primary">
          {book.title}
        </p>
        <p className="truncate text-xs text-muted-foreground">
          {book.authors.join(", ") || "Unknown author"}
        </p>
        {book.externalRating ? (
          <div className="mt-1 flex items-center gap-1.5">
            <RatingStars value={Math.round(book.externalRating)} size={12} />
            <span className="text-[11px] text-muted-foreground">
              {book.externalRating.toFixed(1)} ({compact(book.externalRatingsCount)})
            </span>
          </div>
        ) : null}
      </div>
    </Link>
  );
}
