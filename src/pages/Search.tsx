import { useEffect, useState } from "react";
import { Link, useSearchParams } from "react-router";
import { Compass, Search as SearchIcon, Users } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { trpc } from "@/providers/trpc";
import { BookCard } from "@/components/BookCard";
import { UserAvatar } from "@/components/UserAvatar";

function PeopleResults({ q }: { q: string }) {
  const { data, isLoading } = trpc.profile.search.useQuery(
    { q },
    { enabled: q.trim().length >= 1 },
  );

  if (isLoading) {
    return (
      <div className="space-y-2">
        {Array.from({ length: 6 }).map((_, i) => (
          <Skeleton key={i} className="h-16 w-full rounded-xl" />
        ))}
      </div>
    );
  }

  const people = (data ?? []).filter((p) => p.username);

  if (people.length === 0) {
    return (
      <div className="rounded-xl border border-dashed p-10 text-center text-sm text-muted-foreground">
        No readers found for “{q}”. Try a different username or name.
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
      {people.map((p) => (
        <Link
          key={p.id}
          to={`/u/${p.username}`}
          className="flex items-center gap-3 rounded-xl border bg-card p-3 transition-colors hover:bg-accent"
        >
          <UserAvatar name={p.name} avatar={p.avatar} className="h-11 w-11 shrink-0" />
          <div className="min-w-0">
            <p className="truncate text-sm font-medium">{p.name}</p>
            <p className="truncate text-xs text-muted-foreground">@{p.username}</p>
          </div>
        </Link>
      ))}
    </div>
  );
}

export default function SearchPage() {
  const [params, setParams] = useSearchParams();
  const q = params.get("q") ?? "";
  const mode = params.get("type") === "people" ? "people" : "books";
  const [input, setInput] = useState(q);

  useEffect(() => setInput(q), [q]);
  useEffect(() => {
    const t = setTimeout(() => {
      const trimmed = input.trim();
      if (trimmed !== q) {
        const next: Record<string, string> = {};
        if (trimmed) next.q = trimmed;
        if (mode === "people") next.type = "people";
        setParams(next);
      }
    }, 400);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [input]);

  const setMode = (next: "books" | "people") => {
    const nextParams: Record<string, string> = {};
    if (q) nextParams.q = q;
    if (next === "people") nextParams.type = "people";
    setParams(nextParams);
  };

  const { data, isLoading, isFetching } = trpc.books.search.useQuery(
    { q, startIndex: 0 },
    { enabled: mode === "books" && q.trim().length >= 3, placeholderData: (prev) => prev },
  );
  const { data: trending } = trpc.books.trending.useQuery(undefined, { enabled: mode === "books" && !q });

  return (
    <div className="mx-auto max-w-5xl animate-fade-up">
      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="relative max-w-xl flex-1">
          <SearchIcon size={17} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder={mode === "people" ? "Search readers by username or name…" : "Search by title, author, or genre…"}
            className="h-11 pl-10 text-base"
            autoFocus
          />
        </div>
        <Tabs value={mode} onValueChange={(v) => setMode(v as "books" | "people")}>
          <TabsList>
            <TabsTrigger value="books" className="gap-1.5">
              <Compass size={14} /> Books
            </TabsTrigger>
            <TabsTrigger value="people" className="gap-1.5">
              <Users size={14} /> People
            </TabsTrigger>
          </TabsList>
        </Tabs>
      </div>

      {mode === "people" ? (
        !q ? (
          <div className="rounded-xl border border-dashed p-10 text-center text-sm text-muted-foreground">
            Type a username or name to find friends and other readers.
          </div>
        ) : (
          <PeopleResults q={q} />
        )
      ) : !q ? (
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