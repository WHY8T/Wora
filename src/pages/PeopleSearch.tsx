import { useEffect, useState } from "react";
import { Link, useSearchParams } from "react-router";
import { Check, Clock, Users } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { UserAvatar } from "@/components/UserAvatar";
import { trpc } from "@/providers/trpc";
import { useAuth } from "@/hooks/useAuth";

function FollowButton({ userId }: { userId: number }) {
    const { isAuthenticated } = useAuth();
    const [state, setState] = useState<"none" | "requested" | "connected">("none");
    const follow = trpc.social.follow.useMutation({
        onSuccess: (res) => setState(res.status === "accepted" ? "connected" : "requested"),
    });
    const unfollow = trpc.social.unfollow.useMutation({ onSuccess: () => setState("none") });

    if (!isAuthenticated) return null;

    if (state === "requested") {
        return (
            <Button
                type="button"
                size="sm"
                variant="outline"
                className="shrink-0 gap-1"
                disabled={unfollow.isPending}
                onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    unfollow.mutate({ userId });
                }}
            >
                <Clock size={14} /> Requested
            </Button>
        );
    }

    return (
        <Button
            type="button"
            size="sm"
            variant={state === "connected" ? "secondary" : "default"}
            className="shrink-0 gap-1"
            disabled={follow.isPending || unfollow.isPending}
            onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                if (state === "connected") unfollow.mutate({ userId });
                else follow.mutate({ userId });
            }}
        >
            {state === "connected" ? (
                <>
                    <Check size={14} /> Connected
                </>
            ) : (
                "Follow"
            )}
        </Button>
    );
}

export default function PeopleSearch() {
    const [params, setParams] = useSearchParams();
    const q = params.get("q") ?? "";
    const [input, setInput] = useState(q);

    useEffect(() => setInput(q), [q]);
    // Every keystroke updates the URL almost immediately — this is a fast,
    // local username/name lookup, not an external API call, so it doesn't
    // need the longer debounce the book search uses.
    useEffect(() => {
        const t = setTimeout(() => {
            const trimmed = input.trim();
            if (trimmed !== q) setParams(trimmed ? { q: trimmed } : {});
        }, 120);
        return () => clearTimeout(t);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [input]);

    const { data, isLoading, isFetching } = trpc.profile.search.useQuery(
        { q: q.trim() },
        { enabled: q.trim().length >= 1, placeholderData: (prev) => prev },
    );
    const people = (data ?? []).filter((p) => p.username);

    return (
        <div className="mx-auto max-w-2xl animate-fade-up">
            <div className="relative mb-6">
                <Users size={17} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
                <Input
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    placeholder="Search readers by username or name…"
                    className="h-11 pl-10 text-base"
                    autoFocus
                />
            </div>

            {!q.trim() ? (
                <div className="rounded-xl border border-dashed p-10 text-center text-sm text-muted-foreground">
                    Start typing to find friends and other readers on Wora.
                </div>
            ) : (
                <section>
                    {(isLoading && !data) || (isFetching && people.length === 0 && !data) ? (
                        <div className="space-y-2">
                            {Array.from({ length: 6 }).map((_, i) => (
                                <Skeleton key={i} className="h-16 w-full rounded-xl" />
                            ))}
                        </div>
                    ) : people.length === 0 ? (
                        <div className="rounded-xl border border-dashed p-10 text-center text-sm text-muted-foreground">
                            No readers found for “{q}”. Try a different username or name.
                        </div>
                    ) : (
                        <div className="space-y-2">
                            {people.map((p) => (
                                <Link
                                    key={p.id}
                                    to={`/u/${p.username}`}
                                    className="flex items-center gap-3 rounded-xl border bg-card p-3 transition-colors hover:bg-accent"
                                >
                                    <UserAvatar name={p.name} avatar={p.avatar} className="h-11 w-11 shrink-0" />
                                    <div className="min-w-0 flex-1">
                                        <p className="truncate text-sm font-medium">{p.name}</p>
                                        <p className="truncate text-xs text-muted-foreground">@{p.username}</p>
                                    </div>
                                    <FollowButton userId={p.id} />
                                </Link>
                            ))}
                        </div>
                    )}
                </section>
            )}
        </div>
    );
}