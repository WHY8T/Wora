import { useEffect, useState } from "react";
import { Link, useParams, useSearchParams } from "react-router";
import { ChevronLeft, ChevronRight, ExternalLink, Minus, Plus, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { trpc } from "@/providers/trpc";
import { GoogleBooksViewer } from "@/components/GoogleBooksViewer";

const FONT_SIZES = [16, 18, 20, 22, 24] as const;

export default function BookReader() {
  const { externalId } = useParams<{ externalId: string }>();
  const isGutenberg = externalId?.startsWith("gut:") ?? false;
  const isLocal = externalId?.startsWith("local:") ?? false;
  const isGoogle = !isGutenberg && !isLocal;

  if (isGoogle) return <GoogleReaderView externalId={externalId!} />;
  return <TextReaderView externalId={externalId!} />;
}

/** Full paginated text reader — Project Gutenberg (public domain) books only. */
function TextReaderView({ externalId }: { externalId: string }) {
  const [searchParams, setSearchParams] = useSearchParams();
  const page = Number(searchParams.get("page") ?? 0);
  const [fontSizeIdx, setFontSizeIdx] = useState(1);

  const { data, isLoading, error } = trpc.books.readerPage.useQuery(
    { externalId, page },
    { enabled: !!externalId, staleTime: Infinity },
  );

  useEffect(() => {
    window.scrollTo({ top: 0, behavior: "instant" as ScrollBehavior });
  }, [page]);

  const goTo = (next: number) => setSearchParams({ page: String(next) });

  if (error) {
    return (
      <div className="mx-auto flex min-h-dvh max-w-xl flex-col items-center justify-center gap-4 p-6 text-center">
        <p className="text-lg font-medium">Can't read this one here</p>
        <p className="text-sm text-muted-foreground">{error.message}</p>
        <Button asChild variant="outline">
          <Link to={`/book/${externalId}`}>Back to book page</Link>
        </Button>
      </div>
    );
  }

  return (
    <div className="min-h-dvh bg-background">
      <header className="safe-top sticky top-0 z-10 flex items-center justify-between border-b bg-background/95 px-4 py-3 backdrop-blur">
        <Button asChild variant="ghost" size="icon">
          <Link to={`/book/${externalId}`}>
            <X className="h-4 w-4" />
          </Link>
        </Button>
        <p className="max-w-[50%] truncate text-sm font-medium text-muted-foreground">
          {data?.title ?? "Loading…"}
        </p>
        <div className="flex items-center gap-1">
          <Button
            variant="ghost"
            size="icon"
            disabled={fontSizeIdx === 0}
            onClick={() => setFontSizeIdx((i) => Math.max(0, i - 1))}
          >
            <Minus className="h-4 w-4" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            disabled={fontSizeIdx === FONT_SIZES.length - 1}
            onClick={() => setFontSizeIdx((i) => Math.min(FONT_SIZES.length - 1, i + 1))}
          >
            <Plus className="h-4 w-4" />
          </Button>
        </div>
      </header>

      <main className="mx-auto max-w-2xl px-4 py-10 sm:px-6">
        {isLoading || !data ? (
          <div className="space-y-4">
            <Skeleton className="h-5 w-full" />
            <Skeleton className="h-5 w-11/12" />
            <Skeleton className="h-5 w-full" />
            <Skeleton className="h-5 w-4/5" />
            <Skeleton className="h-5 w-full" />
            <Skeleton className="h-5 w-3/4" />
          </div>
        ) : (
          <article
            className="whitespace-pre-line font-serif leading-relaxed text-foreground/90"
            style={{ fontSize: FONT_SIZES[fontSizeIdx] }}
          >
            {data.content}
          </article>
        )}
      </main>

      {data && (
        <footer className="safe-bottom sticky bottom-0 flex items-center justify-between border-t bg-background/95 px-4 py-3 backdrop-blur">
          <Button variant="outline" disabled={page <= 0} onClick={() => goTo(page - 1)}>
            <ChevronLeft className="mr-1 h-4 w-4" />
            Prev
          </Button>
          <span className="text-xs text-muted-foreground">
            Page {data.page + 1} of {data.totalPages}
          </span>
          <Button
            variant="outline"
            disabled={page >= data.totalPages - 1}
            onClick={() => goTo(page + 1)}
          >
            Next
            <ChevronRight className="ml-1 h-4 w-4" />
          </Button>
        </footer>
      )}
    </div>
  );
}

/** Google's own embedded preview viewer — modern/copyrighted books, sample pages only. */
function GoogleReaderView({ externalId }: { externalId: string }) {
  const { data, isLoading } = trpc.books.byExternalId.useQuery({ externalId });

  return (
    <div className="min-h-dvh bg-background">
      <header className="safe-top sticky top-0 z-10 flex items-center justify-between border-b bg-background/95 px-4 py-3 backdrop-blur">
        <Button asChild variant="ghost" size="icon">
          <Link to={`/book/${externalId}`}>
            <X className="h-4 w-4" />
          </Link>
        </Button>
        <p className="max-w-[60%] truncate text-sm font-medium text-muted-foreground">
          {isLoading ? "Loading…" : (data?.book?.title ?? "Preview")}
        </p>
        <span className="w-9" />
      </header>

      <main className="mx-auto max-w-3xl px-4 py-6">
        <GoogleBooksViewer volumeId={externalId} />
        <p className="mt-3 flex items-center gap-1.5 text-xs text-muted-foreground">
          <ExternalLink className="h-3 w-3" />
          Preview provided by Google Books — only the sample pages Google makes
          available for this title, not the full book.
        </p>
      </main>
    </div>
  );
}