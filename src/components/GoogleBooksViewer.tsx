import { useEffect, useRef, useState } from "react";

declare global {
    interface Window {
        google?: {
            books: {
                load: (opts?: { language?: string }) => void;
                setOnLoadCallback: (cb: () => void) => void;
                DefaultViewer: new (el: HTMLElement) => {
                    load: (volumeId: string, onError?: () => void) => void;
                };
            };
        };
    }
}

let jsapiPromise: Promise<void> | null = null;

function loadGoogleJsApi(): Promise<void> {
    if (window.google?.books) return Promise.resolve();
    if (jsapiPromise) return jsapiPromise;
    jsapiPromise = new Promise((resolve, reject) => {
        const script = document.createElement("script");
        script.src = "https://www.google.com/books/jsapi.js";
        script.async = true;
        script.onload = () => resolve();
        script.onerror = () => reject(new Error("Failed to load Google's book viewer"));
        document.head.appendChild(script);
    });
    return jsapiPromise;
}

/**
 * Embeds Google's own official Books preview viewer in-page, so browsing a
 * preview never leaves the app. This still only ever shows whatever sample
 * pages Google itself makes available for that title — never the full book.
 */
export function GoogleBooksViewer({ volumeId }: { volumeId: string }) {
    const containerRef = useRef<HTMLDivElement>(null);
    const [status, setStatus] = useState<"loading" | "ready" | "error">("loading");

    useEffect(() => {
        let cancelled = false;
        setStatus("loading");

        loadGoogleJsApi()
            .then(() => {
                if (cancelled) return;
                window.google!.books.load();
                window.google!.books.setOnLoadCallback(() => {
                    if (cancelled || !containerRef.current) return;
                    containerRef.current.innerHTML = "";
                    const viewer = new window.google!.books.DefaultViewer(containerRef.current);
                    viewer.load(volumeId, () => {
                        if (!cancelled) setStatus("error");
                    });
                    if (!cancelled) setStatus("ready");
                });
            })
            .catch(() => {
                if (!cancelled) setStatus("error");
            });

        return () => {
            cancelled = true;
        };
    }, [volumeId]);

    return (
        <div className="relative h-[75vh] w-full overflow-hidden rounded-lg border bg-white">
            {status === "loading" && (
                <div className="absolute inset-0 flex items-center justify-center text-sm text-muted-foreground">
                    Loading preview…
                </div>
            )}
            {status === "error" && (
                <div className="absolute inset-0 flex flex-col items-center justify-center gap-1 p-6 text-center text-sm text-muted-foreground">
                    <p>This book doesn't have a preview available from Google.</p>
                </div>
            )}
            <div ref={containerRef} className="h-full w-full" />
        </div>
    );
}