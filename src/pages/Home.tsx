import { Link } from "react-router";
import { ArrowRight, Flame, Sparkles, TrendingUp } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { trpc } from "@/providers/trpc";
import { PostCard } from "@/components/PostCard";
import { ActivityItem } from "@/components/ActivityItem";
import { BookCover } from "@/components/BookCover";
import { UserAvatar } from "@/components/UserAvatar";
import { useAuth } from "@/hooks/useAuth";

function TrendingBooksRail() {
  const { data, isLoading } = trpc.books.trending.useQuery();
  return (
    <section className="animate-fade-up">
      <div className="mb-3 flex items-center justify-between">
        <h2 className="flex items-center gap-2 font-display text-lg font-semibold">
          <Flame size={18} className="text-primary" /> Trending books
        </h2>
        <Button variant="ghost" size="sm" asChild className="gap-1 text-muted-foreground">
          <Link to="/search">
            Browse all <ArrowRight size={14} />
          </Link>
        </Button>
      </div>
      <div className="flex gap-3 overflow-x-auto pb-2 [scrollbar-width:thin]">
        {isLoading
          ? Array.from({ length: 8 }).map((_, i) => (
              <Skeleton key={i} className="aspect-[2/3] w-28 shrink-0 rounded-md" />
            ))
          : (data ?? []).slice(0, 12).map((b) => (
              <Link
                key={b.externalId}
                to={`/book/${encodeURIComponent(b.externalId)}`}
                className="group w-28 shrink-0"
                title={b.title}
              >
                <div className="transition-transform duration-300 group-hover:-translate-y-1">
                  <BookCover cover={b.cover} title={b.title} className="w-28 shadow-md" />
                </div>
                <p className="mt-1.5 truncate text-xs font-medium group-hover:text-primary">{b.title}</p>
                <p className="truncate text-[11px] text-muted-foreground">{b.authors[0]}</p>
              </Link>
            ))}
      </div>
    </section>
  );
}

function Feed() {
  const { data: feed } = trpc.social.feed.useQuery({ limit: 30 });
  const { data: trending, isLoading: tLoading } = trpc.posts.trending.useQuery({ limit: 15 });

  return (
    <div className="space-y-6">
      {feed && feed.length > 0 ? (
        <section className="animate-fade-up stagger-1">
          <h2 className="mb-3 flex items-center gap-2 font-display text-lg font-semibold">
            <Sparkles size={18} className="text-primary" /> From your circle
          </h2>
          <div className="space-y-2.5">
            {feed.map((a) => (
              <ActivityItem key={a.id} activity={a} />
            ))}
          </div>
        </section>
      ) : null}
      <section className="animate-fade-up stagger-2">
        <h2 className="mb-3 flex items-center gap-2 font-display text-lg font-semibold">
          <TrendingUp size={18} className="text-primary" /> Trending in communities
        </h2>
        <div className="space-y-2.5">
          {tLoading
            ? Array.from({ length: 4 }).map((_, i) => (
                <Skeleton key={i} className="h-28 w-full rounded-xl" />
              ))
            : (trending ?? []).map((p) => <PostCard key={p.id} post={p} />)}
          {!tLoading && (trending ?? []).length === 0 ? (
            <div className="rounded-xl border border-dashed p-8 text-center text-sm text-muted-foreground">
              No posts yet — join a community and start the first discussion.
              <div className="mt-3">
                <Button asChild size="sm">
                  <Link to="/communities">Explore communities</Link>
                </Button>
              </div>
            </div>
          ) : null}
        </div>
      </section>
    </div>
  );
}

function RightRail() {
  const { data: communities } = trpc.communities.list.useQuery();
  const { data: suggestions } = trpc.social.suggestions.useQuery();
  const { user } = useAuth();
  const utils = trpc.useUtils();
  const follow = trpc.social.follow.useMutation({
    onSuccess: () => {
      utils.social.suggestions.invalidate();
      utils.social.feed.invalidate();
    },
  });

  return (
    <aside className="hidden w-72 shrink-0 space-y-6 lg:block">
      <section className="rounded-xl border bg-card p-4">
        <h3 className="font-display text-sm font-semibold">Popular communities</h3>
        <div className="mt-3 space-y-2.5">
          {(communities ?? []).slice(0, 5).map((c) => (
            <Link key={c.id} to={`/w/${c.slug}`} className="flex items-center gap-2.5 text-sm group">
              <span
                className="flex h-7 w-7 items-center justify-center rounded-lg text-xs font-bold text-white"
                style={{ backgroundColor: c.color }}
              >
                {c.name[0]}
              </span>
              <span className="min-w-0 flex-1">
                <span className="block truncate font-medium group-hover:text-primary">w/{c.slug}</span>
                <span className="block text-xs text-muted-foreground">{c.memberCount} members</span>
              </span>
            </Link>
          ))}
        </div>
        <Button variant="ghost" size="sm" asChild className="mt-3 w-full text-muted-foreground">
          <Link to="/communities">View all</Link>
        </Button>
      </section>
      {user && (suggestions ?? []).length > 0 ? (
        <section className="rounded-xl border bg-card p-4">
          <h3 className="font-display text-sm font-semibold">Readers to follow</h3>
          <div className="mt-3 space-y-3">
            {(suggestions ?? []).slice(0, 5).map((s) => (
              <div key={s.id} className="flex items-center gap-2.5">
                <Link to={s.username ? `/u/${s.username}` : "#"} className="flex min-w-0 flex-1 items-center gap-2.5">
                  <UserAvatar name={s.name} avatar={s.avatar} className="h-8 w-8" />
                  <span className="min-w-0">
                    <span className="block truncate text-sm font-medium">{s.name}</span>
                    {s.username ? (
                      <span className="block truncate text-xs text-muted-foreground">@{s.username}</span>
                    ) : null}
                  </span>
                </Link>
                <Button
                  size="sm"
                  variant="outline"
                  disabled={follow.isPending}
                  onClick={() => follow.mutate({ userId: s.id })}
                >
                  Follow
                </Button>
              </div>
            ))}
          </div>
        </section>
      ) : null}
    </aside>
  );
}

export default function HomePage() {
  return (
    <div className="mx-auto flex max-w-6xl gap-8">
      <div className="min-w-0 flex-1 space-y-8">
        <TrendingBooksRail />
        <Feed />
      </div>
      <div className="pt-1">
        <RightRail />
      </div>
    </div>
  );
}
