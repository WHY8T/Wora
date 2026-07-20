import { useState } from "react";
import { Link, useParams } from "react-router";
import { BookOpen, BookOpenCheck, ExternalLink, LibraryBig, PenLine, Users } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { trpc } from "@/providers/trpc";
import { BookCover } from "@/components/BookCover";
import { RatingStars } from "@/components/RatingStars";
import { ShelveButton } from "@/components/ShelveButton";
import { UserAvatar } from "@/components/UserAvatar";
import { compact, timeAgo } from "@/lib/format";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";

function ReviewForm({ externalId, existing, onDone }: { externalId: string; existing?: { rating: number; body: string | null } | null; onDone: () => void }) {
  const [rating, setRating] = useState(existing?.rating ?? 0);
  const [body, setBody] = useState(existing?.body ?? "");
  const utils = trpc.useUtils();
  const upsert = trpc.reviews.upsert.useMutation({
    onSuccess: () => {
      toast.success("Review saved");
      utils.reviews.forBook.invalidate({ externalId });
      utils.reviews.mineForBook.invalidate({ externalId });
      utils.books.byExternalId.invalidate({ externalId });
      onDone();
    },
    onError: (e) => toast.error(e.message),
  });
  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <span className="text-sm text-muted-foreground">Your rating</span>
        <RatingStars value={rating} onChange={setRating} size={26} />
      </div>
      <Textarea
        value={body}
        onChange={(e) => setBody(e.target.value)}
        placeholder="What did you think? (optional)"
        rows={5}
        maxLength={5000}
      />
      <Button
        className="w-full"
        disabled={rating === 0 || upsert.isPending}
        onClick={() => upsert.mutate({ externalId, rating, body: body || undefined })}
      >
        {upsert.isPending ? "Saving…" : existing ? "Update review" : "Publish review"}
      </Button>
    </div>
  );
}

export default function BookDetail() {
  const { externalId = "" } = useParams();
  const { isAuthenticated } = useAuth();
  const { data, isLoading } = trpc.books.byExternalId.useQuery({ externalId });
  const { data: reviews } = trpc.reviews.forBook.useQuery({ externalId });
  const { data: mine } = trpc.reviews.mineForBook.useQuery({ externalId }, { enabled: isAuthenticated });
  const [open, setOpen] = useState(false);
  const utils = trpc.useUtils();

  const quickRate = trpc.reviews.upsert.useMutation({
    onSuccess: (_d, vars) => {
      toast.success(`Rated ${vars.rating}★`);
      utils.reviews.mineForBook.invalidate({ externalId });
      utils.reviews.forBook.invalidate({ externalId });
      utils.books.byExternalId.invalidate({ externalId });
    },
  });

  if (isLoading) {
    return (
      <div className="mx-auto max-w-4xl space-y-6">
        <div className="flex gap-6">
          <Skeleton className="aspect-[2/3] w-40 rounded-lg sm:w-52" />
          <div className="flex-1 space-y-3 pt-2">
            <Skeleton className="h-8 w-3/4" />
            <Skeleton className="h-4 w-1/2" />
            <Skeleton className="h-24 w-full" />
          </div>
        </div>
      </div>
    );
  }
  if (!data) {
    return (
      <div className="mx-auto max-w-4xl rounded-xl border border-dashed p-10 text-center text-muted-foreground">
        Book not found.
      </div>
    );
  }

  const { book, stats } = data;

  return (
    <div className="mx-auto max-w-4xl animate-fade-up">
      <div className="flex flex-col gap-6 sm:flex-row sm:gap-8">
        <div className="w-40 shrink-0 sm:w-52">
          <BookCover cover={book.cover} title={book.title} className="w-full shadow-xl" />
          <div className="mt-4 space-y-3">
            <ShelveButton externalId={book.externalId} className="w-full" />
            {book.readUrl ? (
              <Button asChild className="h-auto w-full whitespace-normal py-2.5 text-center leading-snug">
                <Link to={`/book/${book.externalId}/read`} className="flex items-center justify-center gap-2">
                  <BookOpenCheck className="h-4 w-4 shrink-0" />
                  <span>{book.source === "gutendex" ? "Read free in Wora" : "Preview in Wora"}</span>
                </Link>
              </Button>
            ) : (
              <Button
                asChild
                variant="outline"
                className="h-auto w-full whitespace-normal py-2.5 text-center leading-snug text-muted-foreground"
              >
                <a
                  href={`https://www.google.com/search?tbm=bks&q=${encodeURIComponent(
                    `${book.title} ${book.authors[0] ?? ""}`,
                  )}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center justify-center gap-2"
                >
                  <BookOpenCheck className="h-4 w-4 shrink-0" />
                  <span>Find where to read</span>
                  <ExternalLink className="h-3.5 w-3.5 shrink-0 opacity-60" />
                </a>
              </Button>
            )}
            {isAuthenticated ? (
              <>
                <div className="rounded-xl border bg-card p-3">
                  <p className="mb-1.5 text-xs font-medium text-muted-foreground">Rate this book</p>
                  <RatingStars
                    value={mine?.rating ?? 0}
                    size={24}
                    onChange={(v) => v > 0 && quickRate.mutate({ externalId, rating: v })}
                  />
                </div>
                <Dialog open={open} onOpenChange={setOpen}>
                  <DialogTrigger asChild>
                    <Button variant="outline" className="w-full gap-2">
                      <PenLine size={15} /> {mine?.body ? "Edit review" : "Write a review"}
                    </Button>
                  </DialogTrigger>
                  <DialogContent>
                    <DialogHeader>
                      <DialogTitle className="font-display">
                        {mine ? "Update your review" : "Review"} — {book.title}
                      </DialogTitle>
                    </DialogHeader>
                    <ReviewForm externalId={externalId} existing={mine} onDone={() => setOpen(false)} />
                  </DialogContent>
                </Dialog>
              </>
            ) : null}
          </div>
        </div>

        <div className="min-w-0 flex-1">
          <h1 className="font-display text-3xl font-semibold leading-tight">{book.title}</h1>
          <p className="mt-1.5 text-muted-foreground">
            by <span className="font-medium text-foreground">{book.authors.join(", ") || "Unknown author"}</span>
          </p>

          <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-2 text-sm">
            {book.externalRating ? (
              <span className="flex items-center gap-1.5">
                <RatingStars value={Math.round(book.externalRating)} size={15} />
                <span className="font-medium">{book.externalRating.toFixed(1)}</span>
                <span className="text-muted-foreground">· {compact(book.externalRatingsCount)} ratings</span>
              </span>
            ) : null}
            {stats.avgRating ? (
              <span className="rounded-full bg-primary/10 px-2.5 py-1 text-xs font-medium text-primary">
                {stats.avgRating}★ on Wora ({stats.ratingsCount})
              </span>
            ) : null}
          </div>

          <div className="mt-3 flex flex-wrap gap-1.5">
            {book.categories.map((c) => (
              <Badge key={c} variant="secondary" className="font-normal">
                {c}
              </Badge>
            ))}
          </div>

          {book.description ? (
            <p className="mt-4 text-sm leading-relaxed text-muted-foreground">{book.description}</p>
          ) : null}

          <div className="mt-5 grid grid-cols-3 gap-3">
            <div className="rounded-xl border bg-card p-3 text-center">
              <BookOpen size={16} className="mx-auto text-primary" />
              <p className="mt-1 text-sm font-semibold">{book.pageCount ?? "—"}</p>
              <p className="text-[11px] text-muted-foreground">pages</p>
            </div>
            <div className="rounded-xl border bg-card p-3 text-center">
              <LibraryBig size={16} className="mx-auto text-primary" />
              <p className="mt-1 text-sm font-semibold">{stats.shelvedCount}</p>
              <p className="text-[11px] text-muted-foreground">on shelves</p>
            </div>
            <div className="rounded-xl border bg-card p-3 text-center">
              <Users size={16} className="mx-auto text-primary" />
              <p className="mt-1 text-sm font-semibold">{stats.ratingsCount}</p>
              <p className="text-[11px] text-muted-foreground">Wora ratings</p>
            </div>
          </div>

          <p className="mt-4 text-xs text-muted-foreground">
            {book.publishedDate ? `Published ${book.publishedDate}` : ""}
            {book.isbn ? ` · ISBN ${book.isbn}` : ""}
          </p>
        </div>
      </div>

      <section className="mt-10">
        <h2 className="mb-4 font-display text-xl font-semibold">
          Community reviews {reviews && reviews.length > 0 ? `(${reviews.length})` : ""}
        </h2>
        <div className="space-y-3">
          {(reviews ?? []).map((r) => (
            <div key={r.id} className="rounded-xl border bg-card p-4">
              <div className="flex items-center gap-2.5">
                <UserAvatar name={r.author?.name} avatar={r.author?.avatar} className="h-8 w-8" />
                <div className="min-w-0 flex-1">
                  <Link
                    to={r.author?.username ? `/u/${r.author.username}` : "#"}
                    className="text-sm font-medium hover:text-primary"
                  >
                    {r.author?.username ? `@${r.author.username}` : r.author?.name ?? "reader"}
                  </Link>
                  <div className="flex items-center gap-2">
                    <RatingStars value={r.rating} size={13} />
                    <span className="text-xs text-muted-foreground">{timeAgo(r.createdAt)}</span>
                  </div>
                </div>
              </div>
              {r.body ? <p className="mt-2.5 text-sm leading-relaxed">{r.body}</p> : null}
            </div>
          ))}
          {(reviews ?? []).length === 0 ? (
            <div className="rounded-xl border border-dashed p-8 text-center text-sm text-muted-foreground">
              No reviews yet. Be the first to share what you thought.
            </div>
          ) : null}
        </div>
      </section>
    </div>
  );
}