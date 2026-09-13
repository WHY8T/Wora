import { useState } from "react";
import { Link, useParams } from "react-router";
import { MessageSquare } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { trpc } from "@/providers/trpc";
import { VoteButtons } from "@/components/VoteButtons";
import { UserAvatar } from "@/components/UserAvatar";
import { BookCover } from "@/components/BookCover";
import { timeAgo } from "@/lib/format";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";
import type { inferRouterOutputs } from "@trpc/server";
import type { AppRouter } from "../../api/router";

type CommentT = inferRouterOutputs<AppRouter>["comments"]["byPost"][number];

function CommentNode({
  comment,
  childrenMap,
  depth,
  onReply,
}: {
  comment: CommentT;
  childrenMap: Map<number, CommentT[]>;
  depth: number;
  onReply: (parentId: number, body: string) => void;
}) {
  const [replying, setReplying] = useState(false);
  const [text, setText] = useState("");
  const { isAuthenticated } = useAuth();
  const kids = childrenMap.get(comment.id) ?? [];
  return (
    <div className={depth > 0 ? "ml-5 border-l-2 border-border pl-3.5 sm:ml-7 sm:pl-4" : ""}>
      <div className="py-2.5">
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <UserAvatar name={comment.author?.name} avatar={comment.author?.avatar} className="h-6 w-6" />
          <Link
            to={comment.author?.username ? `/u/${comment.author.username}` : "#"}
            className="font-medium text-foreground hover:text-primary"
          >
            {comment.author?.username ? `@${comment.author.username}` : comment.author?.name ?? "reader"}
          </Link>
          <span>{timeAgo(comment.createdAt)}</span>
        </div>
        <p className="mt-1.5 whitespace-pre-wrap text-sm leading-relaxed">{comment.body}</p>
        <div className="mt-1 flex items-center gap-1">
          <VoteButtons
            targetType="comment"
            targetId={comment.id}
            score={comment.score}
            myVote={comment.myVote}
            layout="horizontal"
          />
          {isAuthenticated && depth < 4 ? (
            <button
              className="ml-2 rounded-md px-2 py-1 text-xs font-medium text-muted-foreground hover:bg-accent"
              onClick={() => setReplying((r) => !r)}
            >
              Reply
            </button>
          ) : null}
        </div>
        {replying ? (
          <div className="mt-2 flex gap-2">
            <Textarea
              value={text}
              onChange={(e) => setText(e.target.value)}
              rows={2}
              placeholder="Write a reply…"
              className="text-sm"
              autoFocus
            />
            <Button
              size="sm"
              className="self-end"
              disabled={!text.trim()}
              onClick={() => {
                onReply(comment.id, text.trim());
                setText("");
                setReplying(false);
              }}
            >
              Reply
            </Button>
          </div>
        ) : null}
      </div>
      {kids.map((k) => (
        <CommentNode key={k.id} comment={k} childrenMap={childrenMap} depth={depth + 1} onReply={onReply} />
      ))}
    </div>
  );
}

export default function PostDetail() {
  const { id = "0" } = useParams();
  const postId = Number(id);
  const { isAuthenticated } = useAuth();
  const { data: post, isLoading } = trpc.posts.byId.useQuery({ id: postId });
  const { data: comments } = trpc.comments.byPost.useQuery({ postId });
  const [text, setText] = useState("");
  const utils = trpc.useUtils();

  const create = trpc.comments.create.useMutation({
    onSuccess: () => {
      utils.comments.byPost.invalidate({ postId });
      utils.posts.byId.invalidate({ id: postId });
    },
    onError: (e) => toast.error(e.message),
  });

  if (isLoading) {
    return (
      <div className="mx-auto max-w-3xl space-y-4">
        <Skeleton className="h-40 rounded-xl" />
        <Skeleton className="h-24 rounded-xl" />
      </div>
    );
  }
  if (!post) {
    return (
      <div className="mx-auto max-w-3xl rounded-xl border border-dashed p-10 text-center text-muted-foreground">
        Post not found.
      </div>
    );
  }

  const childrenMap = new Map<number, CommentT[]>();
  const roots: CommentT[] = [];
  for (const c of comments ?? []) {
    if (c.parentId) {
      const arr = childrenMap.get(c.parentId) ?? [];
      arr.push(c);
      childrenMap.set(c.parentId, arr);
    } else {
      roots.push(c);
    }
  }

  const submit = (parentId: number | undefined, body: string) =>
    create.mutate({ postId, body, parentId });

  return (
    <div className="mx-auto max-w-3xl animate-fade-up">
      <div className="rounded-xl border bg-card p-4 sm:p-6">
        <div className="flex gap-3 sm:gap-4">
          <VoteButtons targetType="post" targetId={post.id} score={post.score} myVote={post.myVote} />
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted-foreground">
              {post.community ? (
                <Link
                  to={`/w/${post.community.slug}`}
                  className="rounded-full px-2 py-0.5 font-medium text-white"
                  style={{ backgroundColor: post.community.color }}
                >
                  w/{post.community.slug}
                </Link>
              ) : null}
              <Badge variant="secondary">{post.type}</Badge>
              <Link
                to={post.author?.username ? `/u/${post.author.username}` : "#"}
                className="flex items-center gap-1 hover:text-primary"
              >
                <UserAvatar name={post.author?.name} avatar={post.author?.avatar} className="h-4 w-4" />
                {post.author?.username ? `@${post.author.username}` : post.author?.name ?? "reader"}
              </Link>
              <span>· {timeAgo(post.createdAt)}</span>
            </div>
            <h1 className="mt-2 font-display text-xl font-semibold leading-snug sm:text-2xl">{post.title}</h1>
            {post.body ? (
              <p className="mt-3 whitespace-pre-wrap text-sm leading-relaxed sm:text-[15px]">{post.body}</p>
            ) : null}
            {post.book ? (
              <Link
                to={`/book/${encodeURIComponent(post.book.externalId)}`}
                className="mt-4 flex max-w-md items-center gap-3 rounded-xl border bg-background p-3 transition-colors hover:border-primary/30"
              >
                <BookCover cover={post.book.cover} title={post.book.title} className="w-12 shadow" />
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium">{post.book.title}</p>
                  <p className="truncate text-xs text-muted-foreground">
                    {(() => {
                      try {
                        return (JSON.parse(post.book.authors ?? "[]") as string[]).join(", ");
                      } catch {
                        return "";
                      }
                    })()}
                  </p>
                </div>
              </Link>
            ) : null}
          </div>
        </div>
      </div>

      <div className="mt-6">
        <h2 className="mb-3 flex items-center gap-2 font-display text-lg font-semibold">
          <MessageSquare size={17} className="text-primary" />
          {post.commentCount} comment{post.commentCount === 1 ? "" : "s"}
        </h2>
        {isAuthenticated ? (
          <div className="mb-4 rounded-xl border bg-card p-3">
            <Textarea
              value={text}
              onChange={(e) => setText(e.target.value)}
              rows={3}
              placeholder="Join the discussion…"
              maxLength={5000}
            />
            <div className="mt-2 flex justify-end">
              <Button
                size="sm"
                disabled={!text.trim() || create.isPending}
                onClick={() => {
                  submit(undefined, text.trim());
                  setText("");
                }}
              >
                Comment
              </Button>
            </div>
          </div>
        ) : null}
        <div className="divide-y rounded-xl border bg-card px-4">
          {roots.length === 0 ? (
            <p className="py-8 text-center text-sm text-muted-foreground">
              No comments yet — share the first thought.
            </p>
          ) : (
            roots.map((c) => (
              <CommentNode
                key={c.id}
                comment={c}
                childrenMap={childrenMap}
                depth={0}
                onReply={(pid, body) => submit(pid, body)}
              />
            ))
          )}
        </div>
      </div>
    </div>
  );
}
