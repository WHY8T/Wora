import { useEffect, useRef, useState } from "react";
import { Link, useNavigate, useParams } from "react-router";
import { ArrowLeft, MessageCircleMore, SendHorizontal } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { UserAvatar } from "@/components/UserAvatar";
import { trpc } from "@/providers/trpc";
import { useAuth } from "@/hooks/useAuth";
import { timeAgo } from "@/lib/format";
import { cn } from "@/lib/utils";

function ConversationList({ activeId }: { activeId?: number }) {
  const { data, isLoading } = trpc.chat.conversations.useQuery(undefined, {
    refetchInterval: 5000,
  });

  if (isLoading) {
    return (
      <div className="space-y-2 p-3">
        {[0, 1, 2, 3].map((i) => (
          <Skeleton key={i} className="h-16 w-full rounded-xl" />
        ))}
      </div>
    );
  }

  if (!data?.length) {
    return (
      <div className="flex flex-col items-center gap-2 p-8 text-center text-sm text-muted-foreground">
        <MessageCircleMore size={28} className="text-muted-foreground/50" />
        <p>No conversations yet.</p>
        <p className="text-xs">Visit a friend's profile and hit "Message" to start one.</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col">
      {data.map((c) => (
        <Link
          key={c.id}
          to={`/messages/${c.id}`}
          className={cn(
            "flex items-center gap-3 border-b px-3 py-3 transition-colors hover:bg-secondary/60",
            activeId === c.id && "bg-secondary",
          )}
        >
          <UserAvatar name={c.otherUser?.name} avatar={c.otherUser?.avatar} className="h-11 w-11" />
          <div className="min-w-0 flex-1">
            <div className="flex items-center justify-between gap-2">
              <p className="truncate text-sm font-medium">
                {c.otherUser?.name ?? "Unknown reader"}
              </p>
              {c.lastMessage ? (
                <span className="shrink-0 text-[11px] text-muted-foreground">
                  {timeAgo(c.lastMessageAt)}
                </span>
              ) : null}
            </div>
            <p className="truncate text-xs text-muted-foreground">
              {c.lastMessage?.body ?? "Say hello 👋"}
            </p>
          </div>
          {c.unreadCount > 0 ? (
            <span className="flex h-5 min-w-5 shrink-0 items-center justify-center rounded-full bg-primary px-1.5 text-[11px] font-semibold text-primary-foreground">
              {c.unreadCount}
            </span>
          ) : null}
        </Link>
      ))}
    </div>
  );
}

function Thread({ conversationId }: { conversationId: number }) {
  const { user } = useAuth();
  const [draft, setDraft] = useState("");
  const scrollRef = useRef<HTMLDivElement>(null);
  const utils = trpc.useUtils();

  const { data, isLoading } = trpc.chat.messages.useQuery(
    { conversationId },
    { refetchInterval: 3000 },
  );
  const conversations = trpc.chat.conversations.useQuery(undefined, { refetchInterval: 5000 });
  const other = conversations.data?.find((c) => c.id === conversationId)?.otherUser;

  const send = trpc.chat.send.useMutation({
    onSuccess: () => {
      setDraft("");
      utils.chat.messages.invalidate({ conversationId });
      utils.chat.conversations.invalidate();
    },
  });
  const markRead = trpc.chat.markRead.useMutation({
    onSuccess: () => {
      utils.chat.conversations.invalidate();
      utils.chat.unreadCount.invalidate();
    },
  });

  useEffect(() => {
    markRead.mutate({ conversationId });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [conversationId, data?.items.length]);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight });
  }, [data?.items.length]);

  function handleSend() {
    const body = draft.trim();
    if (!body || send.isPending) return;
    send.mutate({ conversationId, body });
  }

  return (
    <div className="flex h-full min-h-0 flex-1 flex-col">
      <div className="flex items-center gap-3 border-b px-3 py-2.5">
        <Link to="/messages" className="md:hidden">
          <Button variant="ghost" size="icon">
            <ArrowLeft size={18} />
          </Button>
        </Link>
        <UserAvatar name={other?.name} avatar={other?.avatar} className="h-8 w-8" />
        <p className="truncate text-sm font-medium">{other?.name ?? "Conversation"}</p>
      </div>

      <div ref={scrollRef} className="flex-1 overflow-y-auto px-3 py-4">
        {isLoading ? (
          <div className="space-y-3">
            {[0, 1, 2].map((i) => (
              <Skeleton key={i} className="h-10 w-2/3 rounded-2xl" />
            ))}
          </div>
        ) : (
          <div className="flex flex-col gap-2">
            {(data?.items ?? []).map((m) => {
              const mine = m.senderId === user?.id;
              return (
                <div
                  key={m.id}
                  className={cn("flex", mine ? "justify-end" : "justify-start")}
                >
                  <div
                    className={cn(
                      "max-w-[75%] rounded-2xl px-3.5 py-2 text-sm leading-relaxed",
                      mine
                        ? "rounded-br-sm bg-primary text-primary-foreground"
                        : "rounded-bl-sm bg-secondary",
                    )}
                  >
                    <p className="whitespace-pre-wrap break-words">{m.body}</p>
                    <p
                      className={cn(
                        "mt-0.5 text-right text-[10px] opacity-70",
                        mine ? "text-primary-foreground" : "text-muted-foreground",
                      )}
                    >
                      {timeAgo(m.createdAt)}
                    </p>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      <form
        className="flex items-center gap-2 border-t p-3"
        onSubmit={(e) => {
          e.preventDefault();
          handleSend();
        }}
      >
        <Input
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          placeholder="Write a message…"
          autoComplete="off"
        />
        <Button type="submit" size="icon" disabled={!draft.trim() || send.isPending}>
          <SendHorizontal size={17} />
        </Button>
      </form>
    </div>
  );
}

export default function Messages() {
  const { conversationId } = useParams();
  const navigate = useNavigate();
  const activeId = conversationId ? Number(conversationId) : undefined;

  useEffect(() => {
    if (conversationId && Number.isNaN(Number(conversationId))) navigate("/messages", { replace: true });
  }, [conversationId, navigate]);

  return (
    <div className="mx-auto -mt-5 flex h-[calc(100vh-3.5rem)] max-w-5xl overflow-hidden rounded-none border-x md:mt-0 md:h-[calc(100vh-6rem)] md:rounded-2xl md:border">
      <div
        className={cn(
          "w-full shrink-0 overflow-y-auto border-r md:w-80",
          activeId ? "hidden md:block" : "block",
        )}
      >
        <div className="border-b px-4 py-3">
          <h1 className="font-display text-lg font-semibold">Messages</h1>
        </div>
        <ConversationList activeId={activeId} />
      </div>
      <div className={cn("min-w-0 flex-1", activeId ? "flex" : "hidden md:flex")}>
        {activeId ? (
          <Thread key={activeId} conversationId={activeId} />
        ) : (
          <div className="flex flex-1 flex-col items-center justify-center gap-2 text-center text-sm text-muted-foreground">
            <MessageCircleMore size={32} className="text-muted-foreground/50" />
            Pick a conversation to start chatting.
          </div>
        )}
      </div>
    </div>
  );
}
