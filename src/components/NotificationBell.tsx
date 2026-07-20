import { useState } from "react";
import { Link } from "react-router";
import { Bell, MessageCircle, MessageSquare, Reply, UserPlus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Skeleton } from "@/components/ui/skeleton";
import { UserAvatar } from "@/components/UserAvatar";
import { trpc } from "@/providers/trpc";
import { timeAgo } from "@/lib/format";
import { cn } from "@/lib/utils";

type NotificationItem = {
    id: number;
    type: "follow" | "message" | "comment" | "reply";
    targetId: number | null;
    meta: Record<string, unknown>;
    read: boolean;
    createdAt: string | Date;
    actor: { id: number; name: string | null; avatar: string | null; username: string | null } | null;
};

const ICONS = {
    follow: UserPlus,
    message: MessageCircle,
    comment: MessageSquare,
    reply: Reply,
} as const;

function describe(n: NotificationItem) {
    const who = n.actor?.name ?? "Someone";
    switch (n.type) {
        case "follow":
            return `${who} started following you`;
        case "message":
            return `${who} sent you a message`;
        case "comment":
            return `${who} commented on your post`;
        case "reply":
            return `${who} replied to your comment`;
        default:
            return `${who} did something`;
    }
}

function linkFor(n: NotificationItem) {
    switch (n.type) {
        case "follow":
            return n.actor?.username ? `/u/${n.actor.username}` : "#";
        case "message":
            return n.targetId ? `/messages/${n.targetId}` : "/messages";
        case "comment":
        case "reply":
            return n.targetId ? `/post/${n.targetId}` : "#";
        default:
            return "#";
    }
}

function NotificationRow({ n, onOpen }: { n: NotificationItem; onOpen: (id: number) => void }) {
    const Icon = ICONS[n.type] ?? Bell;
    const preview = typeof n.meta?.preview === "string" ? (n.meta.preview as string) : null;
    return (
        <Link
            to={linkFor(n)}
            onClick={() => onOpen(n.id)}
            className={cn(
                "flex items-start gap-2.5 rounded-lg p-2.5 transition-colors hover:bg-accent",
                !n.read && "bg-primary/5",
            )}
        >
            <div className="relative shrink-0">
                <UserAvatar name={n.actor?.name} avatar={n.actor?.avatar} className="h-9 w-9" />
                <span className="absolute -bottom-1 -right-1 flex h-5 w-5 items-center justify-center rounded-full border-2 border-background bg-secondary text-secondary-foreground">
                    <Icon size={11} />
                </span>
            </div>
            <div className="min-w-0 flex-1">
                <p className="text-sm leading-snug">{describe(n)}</p>
                {preview ? <p className="mt-0.5 truncate text-xs text-muted-foreground">“{preview}”</p> : null}
                <p className="mt-0.5 text-xs text-muted-foreground">{timeAgo(n.createdAt)}</p>
            </div>
            {!n.read ? <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-primary" /> : null}
        </Link>
    );
}

export function NotificationBell() {
    const [open, setOpen] = useState(false);
    const utils = trpc.useUtils();

    const { data: unread } = trpc.notifications.unreadCount.useQuery(undefined, {
        refetchInterval: 15000,
    });
    const { data, isLoading } = trpc.notifications.list.useQuery(undefined, {
        enabled: open,
        refetchInterval: open ? 15000 : false,
    });

    const markRead = trpc.notifications.markRead.useMutation({
        onSuccess: () => {
            utils.notifications.unreadCount.invalidate();
            utils.notifications.list.invalidate();
        },
    });
    const markAllRead = trpc.notifications.markAllRead.useMutation({
        onSuccess: () => {
            utils.notifications.unreadCount.invalidate();
            utils.notifications.list.invalidate();
        },
    });

    const count = unread?.count ?? 0;

    return (
        <Popover open={open} onOpenChange={setOpen}>
            <PopoverTrigger asChild>
                <Button variant="ghost" size="icon" aria-label="Notifications" className="relative">
                    <Bell size={19} />
                    {count > 0 ? (
                        <span className="absolute right-1 top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-primary px-1 text-[9px] font-semibold text-primary-foreground">
                            {count > 99 ? "99+" : count}
                        </span>
                    ) : null}
                </Button>
            </PopoverTrigger>
            <PopoverContent align="end" className="w-[22rem] max-w-[92vw] p-0">
                <div className="flex items-center justify-between border-b px-3 py-2.5">
                    <p className="text-sm font-semibold">Notifications</p>
                    {count > 0 ? (
                        <button
                            type="button"
                            className="text-xs text-primary hover:underline disabled:opacity-50"
                            disabled={markAllRead.isPending}
                            onClick={() => markAllRead.mutate()}
                        >
                            Mark all read
                        </button>
                    ) : null}
                </div>
                <div className="max-h-[70vh] overflow-y-auto p-1.5">
                    {isLoading ? (
                        <div className="space-y-2 p-2">
                            {Array.from({ length: 4 }).map((_, i) => (
                                <Skeleton key={i} className="h-14 w-full rounded-lg" />
                            ))}
                        </div>
                    ) : !data?.length ? (
                        <div className="p-8 text-center text-sm text-muted-foreground">
                            <Bell size={22} className="mx-auto mb-2 text-muted-foreground/50" />
                            Nothing yet — new follows, messages, and comments will show up here.
                        </div>
                    ) : (
                        <div className="space-y-1">
                            {data.map((n) => (
                                <NotificationRow
                                    key={n.id}
                                    n={n as NotificationItem}
                                    onOpen={(id) => {
                                        setOpen(false);
                                        markRead.mutate({ ids: [id] });
                                    }}
                                />
                            ))}
                        </div>
                    )}
                </div>
            </PopoverContent>
        </Popover>
    );
}