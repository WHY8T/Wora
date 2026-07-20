import { useEffect, useState } from "react";
import { Link, useSearchParams } from "react-router";
import { Compass, Search as SearchIcon, UserRound } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { trpc } from "@/providers/trpc";
import { BookCard } from "@/components/BookCard";
import { UserAvatar } from "@/components/UserAvatar";
import { useAuth } from "@/hooks/useAuth";

export default function SearchPage() {
  const [params, setParams] = useSearchParams();
  const q = params.get("q") ?? "";
  const [input, setInput] = useState(q);
  const [tab, setTab] = useState<"books" | "people">("books");

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
    { enabled: tab === "books" && q.trim().length >= 3, placeholderData: (prev) => prev },
  );
  const { data: trending } = trpc.books.trending.useQuery(undefined, { enabled: !q });

  const { user } = useAuth();
  const utils = trpc.useUtils();
  const { data: people, isLoading: peopleLoading } = trpc.profile.search.useQuery(
    { q: q.trim() },
    { enabled: tab === "people" && q.trim().length >= 1 },
  );
  const follow = trpc.social.follow.useMutation({
    onSuccess: () => {
      utils.social.suggestions.invalidate();
      utils.social.feed.invalidate();
    },
  });

  return (
    <div className="mx-auto max-w-5xl animate-fade-up">
      <div className="relative mb-6 max-w-xl">
        <SearchIcon size={17} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
        <Input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder={tab === "books" ? "Search by title, author, or genre…" : "Search by username or name…"}
          className="h-11 pl-10 text-base"
          autoFocus
        />
      </div>

      {q ? (
        <Tabs value={tab} onValueChange={(v) => setTab(v as "books" | "people")} className="mb-5">
          <TabsList>
            <TabsTrigger value="books">Books</TabsTrigger>
            <TabsTrigger value="people">People</TabsTrigger>
          </TabsList>
        </Tabs>
      ) : null}

      {tab === "people" && q ? (
        <section>
          <div className="mb-4 text-sm text-muted-foreground">
            {peopleLoading ? "Searching…" : `${people?.length ?? 0} people found for "${q}"`}
          </div>
          <div className="space-y-1">
            {peopleLoading
              ? Array.from({ length: 6 }).map((_, i) => (
                <Skeleton key={i} className="h-14 w-full rounded-lg" />
              ))
              : (people ?? []).map((p) => (
                <div key={p.id} className="flex items-center gap-3 rounded-lg p-2 hover:bg-secondary/50">
                  <Link
                    to={p.username ? `/u/${p.username}` : "#"}
                    className="flex min-w-0 flex-1 items-center gap-3"
                  >
                    <UserAvatar name={p.name} avatar={p.avatar} className="h-10 w-10" />
                    <span className="min-w-0">
                      <span className="block truncate text-sm font-medium">{p.name}</span>
                      {p.username ? (
                        <span className="block truncate text-xs text-muted-foreground">@{p.username}</span>
                      ) : null}
                    </span>
                  </Link>
                  {user && user.id !== p.id ? (
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={follow.isPending}
                      onClick={() => follow.mutate({ userId: p.id })}
                    >
                      Follow
                    </Button>
                  ) : null}
                </div>
              ))}
          </div>
          {!peopleLoading && (people ?? []).length === 0 ? (
            <div className="rounded-xl border border-dashed p-10 text-center text-sm text-muted-foreground">
              <UserRound size={22} className="mx-auto mb-2 text-muted-foreground" />
              No readers found for "{q}".
            </div>
          ) : null}
        </section>
      ) : null}

      {tab === "books" && !q ? (
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
      ) : tab === "books" && q ? (
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
      ) : null}
    </div>
  );
}