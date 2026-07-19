import { ArrowBigDown, ArrowBigUp } from "lucide-react";
import { trpc } from "@/providers/trpc";
import { useAuth } from "@/hooks/useAuth";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

type Props = {
  targetType: "post" | "comment";
  targetId: number;
  score: number;
  myVote: number;
  layout?: "vertical" | "horizontal";
};

export function VoteButtons({ targetType, targetId, score, myVote, layout = "vertical" }: Props) {
  const { isAuthenticated } = useAuth();
  const utils = trpc.useUtils();

  const postVote = trpc.posts.vote.useMutation({
    onSuccess: () => {
      utils.posts.listByCommunity.invalidate();
      utils.posts.trending.invalidate();
      utils.posts.byId.invalidate({ id: targetId });
    },
  });
  const commentVote = trpc.comments.vote.useMutation({
    onSuccess: () => utils.comments.byPost.invalidate(),
  });

  const cast = (value: 1 | -1) => {
    if (!isAuthenticated) {
      toast("Sign in to vote");
      return;
    }
    const next = myVote === value ? 0 : value;
    if (targetType === "post") {
      postVote.mutate({ postId: targetId, value: next });
    } else {
      commentVote.mutate({ commentId: targetId, value: next });
    }
  };

  const horizontal = layout === "horizontal";

  return (
    <div
      className={cn(
        "flex items-center",
        horizontal ? "flex-row gap-1" : "flex-col gap-0.5",
      )}
    >
      <button
        type="button"
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
          cast(1);
        }}
        className={cn(
          "rounded-md p-1 transition-colors hover:bg-accent",
          myVote === 1 ? "text-primary" : "text-muted-foreground",
        )}
        aria-label="Upvote"
      >
        <ArrowBigUp size={horizontal ? 18 : 22} className={myVote === 1 ? "fill-primary/20" : ""} />
      </button>
      <span
        className={cn(
          "text-xs font-semibold tabular-nums",
          myVote === 1 ? "text-primary" : myVote === -1 ? "text-blue-500" : "text-muted-foreground",
        )}
      >
        {score}
      </span>
      <button
        type="button"
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
          cast(-1);
        }}
        className={cn(
          "rounded-md p-1 transition-colors hover:bg-accent",
          myVote === -1 ? "text-blue-500" : "text-muted-foreground",
        )}
        aria-label="Downvote"
      >
        <ArrowBigDown size={horizontal ? 18 : 22} className={myVote === -1 ? "fill-blue-500/20" : ""} />
      </button>
    </div>
  );
}
