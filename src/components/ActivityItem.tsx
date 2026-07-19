import { Link } from "react-router";
import { BookOpen, MessageSquare, PenLine, Star, UserPlus, Users } from "lucide-react";
import { UserAvatar } from "./UserAvatar";
import { BookCover } from "./BookCover";
import { timeAgo } from "@/lib/format";
import type { inferRouterOutputs } from "@trpc/server";
import type { AppRouter } from "../../api/router";

type Activity = inferRouterOutputs<AppRouter>["social"]["feed"][number];

function sentence(a: Activity): { icon: React.ReactNode; text: React.ReactNode; link?: string } {
  const m = a.meta as Record<string, any>;
  switch (a.type) {
    case "shelved": {
      const shelfLabel =
        m.shelf === "want" ? "wants to read" : m.shelf === "reading" ? "is reading" : m.shelf === "finished" ? "finished" : `shelved`;
      return {
        icon: <BookOpen size={15} className="text-primary" />,
        text: (
          <>
            {shelfLabel} <span className="font-medium text-foreground">{m.bookTitle}</span>
          </>
        ),
        link: m.bookExternalId ? `/book/${encodeURIComponent(m.bookExternalId)}` : undefined,
      };
    }
    case "reviewed":
      return {
        icon: <Star size={15} className="text-amber-500" />,
        text: (
          <>
            rated <span className="font-medium text-foreground">{m.bookTitle}</span>{" "}
            <span className="text-amber-500">{"★".repeat(Number(m.rating ?? 0))}</span>
            {m.excerpt ? <span className="block text-muted-foreground">“{m.excerpt}”</span> : null}
          </>
        ),
        link: m.bookExternalId ? `/book/${encodeURIComponent(m.bookExternalId)}` : undefined,
      };
    case "posted":
      return {
        icon: <PenLine size={15} className="text-sky-500" />,
        text: (
          <>
            posted <span className="font-medium text-foreground">{m.title}</span> in w/{m.communitySlug}
          </>
        ),
        link: m.postId ? `/post/${m.postId}` : undefined,
      };
    case "joined":
      return {
        icon: <Users size={15} className="text-emerald-500" />,
        text: (
          <>
            joined <span className="font-medium text-foreground">w/{m.slug}</span>
          </>
        ),
        link: m.slug ? `/w/${m.slug}` : undefined,
      };
    case "followed":
      return {
        icon: <UserPlus size={15} className="text-violet-500" />,
        text: <>followed <span className="font-medium text-foreground">{m.name}</span></>,
      };
    default:
      return { icon: <MessageSquare size={15} />, text: <>{a.type}</> };
  }
}

export function ActivityItem({ activity }: { activity: Activity }) {
  const s = sentence(activity);
  const m = activity.meta as Record<string, any>;
  const body = (
    <div className="flex items-start gap-3 rounded-xl border bg-card p-3.5 transition-colors hover:border-primary/30">
      <UserAvatar name={activity.author?.name} avatar={activity.author?.avatar} />
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <span className="font-medium text-foreground">
            {activity.author?.username ? `@${activity.author.username}` : activity.author?.name}
          </span>
          <span>· {timeAgo(activity.createdAt)}</span>
        </div>
        <div className="mt-1 flex items-start gap-2 text-sm text-muted-foreground">
          <span className="mt-0.5 shrink-0">{s.icon}</span>
          <span className="min-w-0">{s.text}</span>
        </div>
      </div>
      {m.bookCover ? (
        <BookCover cover={m.bookCover} title={m.bookTitle ?? ""} className="w-10 shrink-0" />
      ) : null}
    </div>
  );
  return s.link ? <Link to={s.link}>{body}</Link> : body;
}
