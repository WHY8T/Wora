import { useState } from "react";
import { useParams, useSearchParams } from "react-router";
import { Flame, Plus, Search, TrendingUp, Clock, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { trpc } from "@/providers/trpc";
import { PostCard } from "@/components/PostCard";
import { BookCover } from "@/components/BookCover";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { POST_TYPES } from "@db/schema";
import type { BookSummary } from "@contracts/types";

function CreatePostDialog({ slug, joined }: { slug: string; joined: boolean }) {
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [type, setType] = useState<(typeof POST_TYPES)[number]>("discussion");
  const [bookQ, setBookQ] = useState("");
  const [book, setBook] = useState<BookSummary | null>(null);
  const utils = trpc.useUtils();
  const { data: bookResults } = trpc.books.search.useQuery(
    { q: bookQ, startIndex: 0 },
    { enabled: bookQ.trim().length > 1 },
  );
  const create = trpc.posts.create.useMutation({
    onSuccess: () => {
      toast.success("Posted");
      utils.posts.listByCommunity.invalidate();
      utils.posts.trending.invalidate();
      setOpen(false);
      setTitle("");
      setBody("");
      setBook(null);
    },
    onError: (e) => toast.error(e.message),
  });

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button
          className="gap-1.5"
          onClick={() => {
            if (!joined) toast("Join the community to post");
          }}
        >
          <Plus size={16} /> New post
        </Button>
      </DialogTrigger>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="font-display">Post to w/{slug}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <Select value={type} onValueChange={(v) => setType(v as typeof type)}>
            <SelectTrigger>
              <SelectValue placeholder="Post type" />
            </SelectTrigger>
            <SelectContent>
              {POST_TYPES.map((t) => (
                <SelectItem key={t} value={t} className="capitalize">
                  {t}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Title" maxLength={300} />
          <Textarea
            value={body}
            onChange={(e) => setBody(e.target.value)}
            placeholder="Share your thoughts… (optional)"
            rows={5}
            maxLength={20000}
          />
          <div>
            <label className="mb-1.5 block text-sm font-medium">Link a book (optional)</label>
            {book ? (
              <div className="flex items-center gap-3 rounded-lg border p-2">
                <BookCover cover={book.cover} title={book.title} className="w-8" />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">{book.title}</p>
                  <p className="truncate text-xs text-muted-foreground">{book.authors.join(", ")}</p>
                </div>
                <Button variant="ghost" size="icon" onClick={() => setBook(null)}>
                  <X size={15} />
                </Button>
              </div>
            ) : (
              <div className="relative">
                <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                <Input
                  value={bookQ}
                  onChange={(e) => setBookQ(e.target.value)}
                  placeholder="Search for a book…"
                  className="pl-9"
                />
                {(bookResults?.items ?? []).length > 0 ? (
                  <div className="absolute z-10 mt-1 max-h-56 w-full overflow-y-auto rounded-lg border bg-popover shadow-lg">
                    {(bookResults?.items ?? []).slice(0, 6).map((b) => (
                      <button
                        key={b.externalId}
                        type="button"
                        className="flex w-full items-center gap-2.5 p-2 text-left hover:bg-accent"
                        onClick={() => {
                          setBook(b);
                          setBookQ("");
                        }}
                      >
                        <BookCover cover={b.cover} title={b.title} className="w-7" />
                        <span className="min-w-0">
                          <span className="block truncate text-sm">{b.title}</span>
                          <span className="block truncate text-xs text-muted-foreground">{b.authors.join(", ")}</span>
                        </span>
                      </button>
                    ))}
                  </div>
                ) : null}
              </div>
            )}
          </div>
          <Button
            className="w-full"
            disabled={title.trim().length < 3 || !joined || create.isPending}
            onClick={() => create.mutate({ slug, title: title.trim(), body: body || undefined, type, bookExternalId: book?.externalId })}
          >
            {create.isPending ? "Posting…" : "Post"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

const SORTS = [
  { key: "hot", label: "Hot", icon: Flame },
  { key: "new", label: "New", icon: Clock },
  { key: "top", label: "Top", icon: TrendingUp },
] as const;

export default function CommunityDetail() {
  const { slug = "" } = useParams();
  const [params, setParams] = useSearchParams();
  const sort = (params.get("sort") as "hot" | "new" | "top") ?? "hot";
  const { isAuthenticated } = useAuth();
  const { data: community, isLoading } = trpc.communities.bySlug.useQuery({ slug });
  const { data: posts, isLoading: postsLoading } = trpc.posts.listByCommunity.useQuery({ slug, sort });
  const utils = trpc.useUtils();
  const join = trpc.communities.join.useMutation({
    onSuccess: () => {
      utils.communities.bySlug.invalidate({ slug });
      utils.communities.mine.invalidate();
    },
  });
  const leave = trpc.communities.leave.useMutation({
    onSuccess: () => {
      utils.communities.bySlug.invalidate({ slug });
      utils.communities.mine.invalidate();
    },
  });

  if (isLoading) {
    return (
      <div className="mx-auto max-w-3xl space-y-4">
        <Skeleton className="h-28 rounded-2xl" />
        <Skeleton className="h-24 rounded-xl" />
        <Skeleton className="h-24 rounded-xl" />
      </div>
    );
  }
  if (!community) {
    return (
      <div className="mx-auto max-w-3xl rounded-xl border border-dashed p-10 text-center text-muted-foreground">
        Community w/{slug} not found.
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-3xl animate-fade-up">
      <div
        className="rounded-2xl p-5 text-white sm:p-6"
        style={{ background: `linear-gradient(135deg, ${community.color}, ${community.color}cc)` }}
      >
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h1 className="font-display text-2xl font-semibold">w/{community.slug}</h1>
            <p className="mt-1 max-w-xl text-sm text-white/85">{community.description}</p>
            <p className="mt-2 text-xs text-white/70">
              {community.memberCount} member{community.memberCount === 1 ? "" : "s"} · {community.postCount} posts
            </p>
          </div>
          {isAuthenticated ? (
            <Button
              variant={community.joined ? "secondary" : "default"}
              className={cn(!community.joined && "bg-white text-black hover:bg-white/90")}
              disabled={join.isPending || leave.isPending}
              onClick={() => (community.joined ? leave.mutate({ communityId: community.id }) : join.mutate({ communityId: community.id }))}
            >
              {community.joined ? "Joined" : "Join"}
            </Button>
          ) : null}
        </div>
      </div>

      <div className="mt-5 flex items-center justify-between gap-3">
        <div className="flex gap-1 rounded-lg border bg-card p-1">
          {SORTS.map(({ key, label, icon: Icon }) => (
            <button
              key={key}
              onClick={() => setParams({ sort: key })}
              className={cn(
                "flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium transition-colors",
                sort === key ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-accent",
              )}
            >
              <Icon size={14} />
              {label}
            </button>
          ))}
        </div>
        {isAuthenticated ? <CreatePostDialog slug={slug} joined={community.joined} /> : null}
      </div>

      <div className="mt-4 space-y-2.5">
        {postsLoading
          ? Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-28 rounded-xl" />)
          : (posts ?? []).map((p) => <PostCard key={p.id} post={p} showCommunity={false} />)}
        {!postsLoading && (posts ?? []).length === 0 ? (
          <div className="rounded-xl border border-dashed p-10 text-center text-sm text-muted-foreground">
            No posts yet. Start the first discussion in w/{community.slug}!
          </div>
        ) : null}
      </div>
      <Badge className="hidden" />
    </div>
  );
}
