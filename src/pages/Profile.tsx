import { Link, useNavigate, useParams } from "react-router";
import { BookOpen, CalendarDays, Check, Clock, MessageCircle, Music, UserPlus, UserCheck2, X } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Progress } from "@/components/ui/progress";
import { trpc } from "@/providers/trpc";
import { UserAvatar } from "@/components/UserAvatar";
import { BookCover } from "@/components/BookCover";
import { ActivityItem } from "@/components/ActivityItem";
import { useAuth } from "@/hooks/useAuth";
import { timeAgo } from "@/lib/format";
import { cn } from "@/lib/utils";

export default function Profile() {
  const { username = "" } = useParams();
  const navigate = useNavigate();
  const { isAuthenticated } = useAuth();
  const { data, isLoading } = trpc.profile.byUsername.useQuery({ username });
  const { data: shelves } = trpc.shelves.byUsername.useQuery({ username });
  const { data: activity } = trpc.social.userActivity.useQuery(
    { userId: data?.user.id ?? 0 },
    { enabled: !!data },
  );
  const utils = trpc.useUtils();
  const follow = trpc.social.follow.useMutation({
    onSuccess: () => utils.profile.byUsername.invalidate({ username }),
  });
  const unfollow = trpc.social.unfollow.useMutation({
    onSuccess: () => utils.profile.byUsername.invalidate({ username }),
  });
  const respond = trpc.social.respondToRequest.useMutation({
    onSuccess: () => utils.profile.byUsername.invalidate({ username }),
  });
  const startChat = trpc.chat.startDirect.useMutation({
    onSuccess: (res) => navigate(`/messages/${res.conversationId}`),
  });

  if (isLoading) {
    return (
      <div className="mx-auto max-w-4xl space-y-4">
        <Skeleton className="h-36 rounded-2xl" />
        <Skeleton className="h-64 rounded-xl" />
      </div>
    );
  }
  if (!data) {
    return (
      <div className="mx-auto max-w-4xl rounded-xl border border-dashed p-10 text-center text-muted-foreground">
        Reader @{username} not found.
      </div>
    );
  }

  const { user, stats } = data;
  const reading = shelves?.find((s) => s.systemKey === "reading");
  const goalProgress = Math.min(100, Math.round((stats.finished / Math.max(1, data.readingGoal)) * 100));

  return (
    <div className="mx-auto max-w-4xl animate-fade-up">
      <div className="rounded-2xl border bg-card p-5 sm:p-6">
        <div className="flex flex-wrap items-start gap-4">
          <div className="relative">
            <UserAvatar
              name={user.name}
              avatar={user.avatar}
              className={cn(
                "h-20 w-20 text-2xl",
                data.relationship === "accepted" && "ring-2 ring-primary ring-offset-2 ring-offset-card",
              )}
            />
            {data.relationship === "accepted" && !data.isMe ? (
              <span className="absolute -bottom-1 -right-1 flex h-6 w-6 items-center justify-center rounded-full border-2 border-card bg-primary text-primary-foreground">
                <UserCheck2 size={13} />
              </span>
            ) : null}
          </div>
          <div className="min-w-0 flex-1">
            <h1 className="font-display text-2xl font-semibold">{user.name}</h1>
            <p className="text-sm text-muted-foreground">@{user.username}</p>
            {user.bio ? <p className="mt-2 max-w-xl text-sm leading-relaxed">{user.bio}</p> : null}
            {user.genres.length > 0 ? (
              <div className="mt-3 flex flex-wrap gap-1.5">
                {user.genres.map((g) => (
                  <Badge key={g} variant="secondary" className="font-normal">
                    {g}
                  </Badge>
                ))}
              </div>
            ) : null}
            {(user.discordUsername || user.spotifyUrl) && (
              <div className="mt-3 flex flex-wrap gap-2">
                {user.discordUsername ? (
                  <span className="inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs text-muted-foreground">
                    <MessageCircle size={13} />
                    {user.discordUsername}
                  </span>
                ) : null}
                {user.spotifyUrl ? (
                  <a
                    href={user.spotifyUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs text-muted-foreground transition-colors hover:border-primary hover:text-primary"
                  >
                    <Music size={13} />
                    Spotify
                  </a>
                ) : null}
              </div>
            )}
          </div>
          {isAuthenticated && !data.isMe ? (
            <div className="flex items-center gap-2">
              {data.relationship === "accepted" ? (
                <>
                  <Button
                    variant="outline"
                    disabled={unfollow.isPending}
                    onClick={() => unfollow.mutate({ userId: user.id })}
                  >
                    <UserCheck2 className="mr-1.5 h-4 w-4" /> Connected
                  </Button>
                  <Button disabled={startChat.isPending} onClick={() => startChat.mutate({ userId: user.id })}>
                    <MessageCircle className="mr-1.5 h-4 w-4" /> Message
                  </Button>
                </>
              ) : data.relationship === "pending_sent" ? (
                <Button
                  variant="outline"
                  disabled={unfollow.isPending}
                  onClick={() => unfollow.mutate({ userId: user.id })}
                >
                  <Clock className="mr-1.5 h-4 w-4" /> Requested
                </Button>
              ) : data.relationship === "pending_received" ? (
                <div className="flex items-center gap-2">
                  <Button disabled={respond.isPending} onClick={() => respond.mutate({ requesterId: user.id, accept: true })}>
                    <Check className="mr-1.5 h-4 w-4" /> Accept
                  </Button>
                  <Button
                    variant="outline"
                    disabled={respond.isPending}
                    onClick={() => respond.mutate({ requesterId: user.id, accept: false })}
                  >
                    <X className="mr-1.5 h-4 w-4" /> Decline
                  </Button>
                </div>
              ) : (
                <Button disabled={follow.isPending} onClick={() => follow.mutate({ userId: user.id })}>
                  <UserPlus className="mr-1.5 h-4 w-4" /> Follow
                </Button>
              )}
            </div>
          ) : null}
          {data.isMe ? (
            <Button variant="outline" asChild>
              <Link to="/settings">Edit profile</Link>
            </Button>
          ) : null}
        </div>

        <div className="mt-5 grid grid-cols-3 gap-3 sm:grid-cols-5">
          {[
            { label: "finished", value: stats.finished },
            { label: "reading now", value: stats.reading },
            { label: "reviews", value: stats.reviews },
            { label: "followers", value: stats.followers },
            { label: "following", value: stats.following },
          ].map((s) => (
            <div key={s.label} className="rounded-xl bg-secondary/60 p-3 text-center">
              <p className="font-display text-xl font-semibold">{s.value}</p>
              <p className="text-[11px] text-muted-foreground">{s.label}</p>
            </div>
          ))}
        </div>

        <div className="mt-4 rounded-xl bg-secondary/60 p-3.5">
          <div className="mb-1.5 flex items-center justify-between text-xs">
            <span className="flex items-center gap-1.5 font-medium">
              <CalendarDays size={13} className="text-primary" />
              {new Date().getFullYear()} reading goal
            </span>
            <span className="text-muted-foreground">
              {stats.finished} / {data.readingGoal} books
            </span>
          </div>
          <Progress value={goalProgress} className="h-2" />
        </div>
      </div>

      {reading && reading.items.length > 0 ? (
        <section className="mt-6 rounded-2xl border bg-card p-5">
          <h2 className="mb-3 flex items-center gap-2 font-display text-lg font-semibold">
            <BookOpen size={17} className="text-primary" /> Currently reading
          </h2>
          <div className="flex gap-3 overflow-x-auto pb-1">
            {reading.items.map((i) => (
              <Link key={i.id} to={`/book/${encodeURIComponent(i.book.externalId)}`} className="w-24 shrink-0 group">
                <BookCover cover={i.book.cover} title={i.book.title} className="w-24 shadow-md transition-transform group-hover:-translate-y-1" />
                <p className="mt-1.5 truncate text-xs font-medium group-hover:text-primary">{i.book.title}</p>
              </Link>
            ))}
          </div>
        </section>
      ) : null}

      <Tabs defaultValue="activity" className="mt-6">
        <TabsList>
          <TabsTrigger value="activity">Activity</TabsTrigger>
          <TabsTrigger value="shelves">Shelves</TabsTrigger>
        </TabsList>
        <TabsContent value="activity" className="mt-4 space-y-2.5">
          {(activity ?? []).length === 0 ? (
            <p className="rounded-xl border border-dashed p-8 text-center text-sm text-muted-foreground">
              No activity yet.
            </p>
          ) : (
            (activity ?? []).map((a) => <ActivityItem key={a.id} activity={a} />)
          )}
        </TabsContent>
        <TabsContent value="shelves" className="mt-4">
          <div className="grid gap-4 sm:grid-cols-3">
            {(shelves ?? [])
              .filter((s) => s.systemKey)
              .map((s) => (
                <div key={s.id} className="rounded-xl border bg-card p-4">
                  <div className="mb-3 flex items-center justify-between">
                    <h3 className="text-sm font-semibold">{s.name}</h3>
                    <span className="text-xs text-muted-foreground">{s.items.length}</span>
                  </div>
                  <div className="space-y-2">
                    {s.items.slice(0, 6).map((i) => (
                      <Link
                        key={i.id}
                        to={`/book/${encodeURIComponent(i.book.externalId)}`}
                        className="flex items-center gap-2.5 rounded-lg p-1.5 hover:bg-accent"
                      >
                        <BookCover cover={i.book.cover} title={i.book.title} className="w-8 shrink-0" />
                        <span className="min-w-0">
                          <span className="block truncate text-xs font-medium">{i.book.title}</span>
                          <span className="block text-[10px] text-muted-foreground">{timeAgo(i.createdAt)}</span>
                        </span>
                      </Link>
                    ))}
                    {s.items.length === 0 ? (
                      <p className="py-4 text-center text-xs text-muted-foreground">Empty shelf</p>
                    ) : null}
                  </div>
                </div>
              ))}
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}