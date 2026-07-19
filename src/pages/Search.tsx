import { useEffect, useState } from "react";
import { useSearchParams } from "react-router";
import { Compass, Search as SearchIcon } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { trpc } from "@/providers/trpc";
import { BookCard } from "@/components/BookCard";

export default function SearchPage() {
  const [params, setParams] = useSearchParams();
  const q = params.get("q") ?? "";
  const [input, setInput] = useState(q);

  useEffect(() => setInput(q), [q]);
  useEffect(() => {
    const t = setTimeout(() => {
      const trimmed = input.trim();
      if ((trimmed.length >= 3 || trimmed.length === 0) && trimmed !== q) {
        setParams(trimmed ? { q: trimmed } : {});
      }
    }, 400);
    return () => clearTimeout(t);
  }, [input, q, setParams]);

  const { data, isLoading, isFetching } = trpc.books.search.useQuery(
    { q, startIndex: 0 },
    { enabled: q.trim().length >= 3, placeholderData: (prev) => prev },
  );
  const { data: trending } = trpc.books.trending.useQuery(undefined, { enabled: !q });

  return (
    <div className="mx-auto max-w-5xl animate-fade-up">
      <div className="relative mb-6 max-w-xl">
        <SearchIcon size={17} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
        <Input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Search by title, author, or genre…"
          className="h-11 pl-10 text-base"
          autoFocus
        />
      </div>

      {!q ? (
        <section>
          <h2 className="mb-4 flex items-center gap-2 font-display text-lg font-semibold">
            <Compass size={18} className="text-primary" /> Trending this week
          </h2>
          <div className="grid grid-cols-3 gap-x-3 gap-y-6 sm:grid-cols-4 md:grid-cols-6">
            {(trending ?? []).slice(0, 12).map((b) => (
              <BookCard key={b.externalId} book={b} />
            ))}
          </div>
        </section>
      ) : (
        <section>
          <div className="mb-4 flex items-center gap-3 text-sm text-muted-foreground">
            <span>
              {isLoading ? "Searching…" : `${data?.items.length ?? 0} results for “${q}”`}
            </span>
            {data?.provider ? (
              <span className="rounded-full bg-secondary px-2 py-0.5 text-xs">
                via {data.provider === "google" ? "Google Books" : data.provider === "gutendex" ? "Open Library classics" : "Wora catalog"}
              </span>
            ) : null}
            {isFetching && !isLoading ? <span className="text-xs">updating…</span> : null}
          </div>
          <div className="grid grid-cols-3 gap-x-3 gap-y-6 sm:grid-cols-4 md:grid-cols-6">
            {isLoading
              ? Array.from({ length: 12 }).map((_, i) => (
                <Skeleton key={i} className="aspect-[2/3] w-full rounded-md" />
              ))
              : (data?.items ?? []).map((b) => <BookCard key={b.externalId} book={b} />)}
          </div>
          {!isLoading && (data?.items ?? []).length === 0 ? (
            <div className="rounded-xl border border-dashed p-10 text-center text-sm text-muted-foreground">
              No books found for “{q}”. Try another title or author.
            </div>
          ) : null}
        </section>
      )}
    </div>
  );
}
