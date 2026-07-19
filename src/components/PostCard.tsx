import { Link } from "react-router";
import { MessageSquare } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { VoteButtons } from "./VoteButtons";
import { UserAvatar } from "./UserAvatar";
import { BookCover } from "./BookCover";
import { timeAgo } from "@/lib/format";
import type { inferRouterOutputs } from "@trpc/server";
import type { AppRouter } from "../../api/router";

type Post = inferRouterOutputs<AppRouter>["posts"]["trending"][number];

const TYPE_STYLES: Record<string, string> = {
  discussion: "bg-secondary text-secondary-foreground",
  review: "bg-amber-500/15 text-amber-600 dark:text-amber-400",
  theory: "bg-violet-500/15 text-violet-600 dark:text-violet-400",
  fanart: "bg-pink-500/15 text-pink-600 dark:text-pink-400",
  question: "bg-sky-500/15 text-sky-600 dark:text-sky-400",
};

export function PostCard({ post, showCommunity = true }: { post: Post; showCommunity?: boolean }) {
  return (
    <div className="group flex gap-3 rounded-xl border bg-card p-3.5 transition-colors hover:border-primary/30 sm:gap-4 sm:p-4">
      <VoteButtons targetType="post" targetId={post.id} score={post.score} myVote={post.myVote} />
      <Link to={`/post/${post.id}`} className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted-foreground">
          {showCommunity && post.community ? (
            <span
              className="rounded-full px-2 py-0.5 font-medium text-white"
              style={{ backgroundColor: post.community.color }}
            >
              w/{post.community.slug}
            </span>
          ) : null}
          <Badge variant="secondary" className={TYPE_STYLES[post.type] ?? ""}>
            {post.type}
          </Badge>
          <span className="flex items-center gap-1">
            <UserAvatar name={post.author?.name} avatar={post.author?.avatar} className="h-4 w-4" />
            {post.author?.username ? `@${post.author.username}` : post.author?.name ?? "reader"}
          </span>
          <span>· {timeAgo(post.createdAt)}</span>
        </div>
        <h3 className="mt-1.5 font-display text-base font-semibold leading-snug transition-colors group-hover:text-primary sm:text-lg">
          {post.title}
        </h3>
        {post.body ? (
          <p className="mt-1 text-sm text-muted-foreground line-clamp-2">{post.body}</p>
        ) : null}
        <div className="mt-2 flex items-center gap-4 text-xs text-muted-foreground">
          <span className="flex items-center gap-1.5">
            <MessageSquare size={14} />
            {post.commentCount} comment{post.commentCount === 1 ? "" : "s"}
          </span>
        </div>
      </Link>
      {post.book ? (
        <Link
          to={`/book/${encodeURIComponent(post.book.externalId)}`}
          className="hidden w-14 shrink-0 self-start sm:block"
          onClick={(e) => e.stopPropagation()}
        >
          <BookCover cover={post.book.cover} title={post.book.title} className="w-14 shadow-sm" />
        </Link>
      ) : null}
    </div>
  );
}
