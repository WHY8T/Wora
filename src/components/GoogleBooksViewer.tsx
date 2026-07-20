import { useEffect, useRef, useState } from "react";
import { ExternalLink } from "lucide-react";
import { Button } from "@/components/ui/button";

const LOAD_TIMEOUT_MS = 9000;

/**
 * Embeds Google's own official Books preview widget in-page, so browsing a
 * preview never leaves the app. This still only ever shows whatever sample
 * pages Google itself makes available for that title — never the full book.
 *
 * Uses Google's public embeddable iframe (the same one behind the "Get HTML"
 * embed code Google Books provides for any volume) rather than the old
 * google.com/books/jsapi.js loader script, which is frequently blocked by ad
 * blockers / privacy extensions and, when blocked, fails completely silently
 * (no loading state, no error — just a blank panel).
 */
export function GoogleBooksViewer({ volumeId }: { volumeId: string }) {
    const [status, setStatus] = useState<"loading" | "ready" | "error">("loading");
    const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

    useEffect(() => {
        setStatus("loading");
        if (timeoutRef.current) clearTimeout(timeoutRef.current);
        timeoutRef.current = setTimeout(() => {
            setStatus((s) => (s === "loading" ? "error" : s));
        }, LOAD_TIMEOUT_MS);
        return () => {
            if (timeoutRef.current) clearTimeout(timeoutRef.current);
        };
    }, [volumeId]);

    const embedUrl = `https://books.google.com/books?id=${encodeURIComponent(volumeId)}&printsec=frontcover&output=embed`;
    const openUrl = `https://books.google.com/books?id=${encodeURIComponent(volumeId)}`;

    return (
        <div className="relative h-[75vh] w-full overflow-hidden rounded-lg border bg-white">
            {status !== "ready" && (
                <div className="absolute inset-0 z-10 flex flex-col items-center justify-center gap-3 bg-white p-6 text-center text-sm text-muted-foreground">
                    {status === "loading" ? (
                        <p>Loading preview…</p>
                    ) : (
                        <>
                            <p>This preview couldn't load here.</p>
                            <Button asChild size="sm" variant="outline">
                                <a href={openUrl} target="_blank" rel="noopener noreferrer">
                                    Open in Google Books
                                    <ExternalLink className="ml-1.5 h-3.5 w-3.5" />
                                </a>
                            </Button>
                        </>
                    )}
                </div>
            )}
            <iframe
                key={volumeId}
                title="Google Books preview"
                src={embedUrl}
                className="h-full w-full border-0"
                onLoad={() => {
                    if (timeoutRef.current) clearTimeout(timeoutRef.current);
                    setStatus("ready");
                }}
                onError={() => {
                    if (timeoutRef.current) clearTimeout(timeoutRef.current);
                    setStatus("error");
                }}
            />
        </div>
    );
}