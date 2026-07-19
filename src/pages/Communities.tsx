import { useState } from "react";
import { Link } from "react-router";
import { Plus, Search, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { trpc } from "@/providers/trpc";
import { COMMUNITY_COLORS } from "@contracts/constants";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

function CreateCommunityDialog() {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [color, setColor] = useState<string>(COMMUNITY_COLORS[0]);
  const utils = trpc.useUtils();
  const create = trpc.communities.create.useMutation({
    onSuccess: () => {
      toast.success("Community created");
      utils.communities.list.invalidate();
      utils.communities.mine.invalidate();
      setOpen(false);
    },
    onError: (e) => toast.error(e.message),
  });
  const slug = name.toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "").slice(0, 32);
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button className="gap-1.5">
          <Plus size={16} /> New community
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="font-display">Create a community</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div>
            <label className="mb-1.5 block text-sm font-medium">Name</label>
            <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Sci-Fi Book Club" maxLength={64} />
            {slug ? <p className="mt-1 text-xs text-muted-foreground">w/{slug}</p> : null}
          </div>
          <div>
            <label className="mb-1.5 block text-sm font-medium">Description</label>
            <Textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={3} maxLength={1000} placeholder="What's this community about?" />
          </div>
          <div>
            <label className="mb-1.5 block text-sm font-medium">Color</label>
            <div className="flex gap-2">
              {COMMUNITY_COLORS.map((c) => (
                <button
                  key={c}
                  type="button"
                  onClick={() => setColor(c)}
                  className={cn("h-8 w-8 rounded-full transition-transform", color === c && "scale-110 ring-2 ring-foreground/40 ring-offset-2 ring-offset-background")}
                  style={{ backgroundColor: c }}
                  aria-label={c}
                />
              ))}
            </div>
          </div>
          <Button
            className="w-full"
            disabled={slug.length < 2 || name.trim().length < 2 || create.isPending}
            onClick={() => create.mutate({ slug, name: name.trim(), description: description || undefined, color: color as any })}
          >
            {create.isPending ? "Creating…" : "Create community"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

export default function Communities() {
  const [q, setQ] = useState("");
  const { isAuthenticated } = useAuth();
  const { data, isLoading } = trpc.communities.list.useQuery(q ? { q } : undefined);
  const utils = trpc.useUtils();

  const join = trpc.communities.join.useMutation({
    onSuccess: () => {
      utils.communities.list.invalidate();
      utils.communities.mine.invalidate();
    },
  });
  const leave = trpc.communities.leave.useMutation({
    onSuccess: () => {
      utils.communities.list.invalidate();
      utils.communities.mine.invalidate();
    },
  });

  return (
    <div className="mx-auto max-w-4xl animate-fade-up">
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl font-semibold">Communities</h1>
          <p className="text-sm text-muted-foreground">Find your people — every genre has a home.</p>
        </div>
        {isAuthenticated ? <CreateCommunityDialog /> : null}
      </div>

      <div className="relative mb-5 max-w-sm">
        <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
        <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search communities…" className="pl-9" />
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        {isLoading
          ? Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-32 rounded-xl" />)
          : (data ?? []).map((c, i) => (
              <div
                key={c.id}
                className={cn("rounded-xl border bg-card p-4 transition-colors hover:border-primary/30", `stagger-${(i % 5) + 1}`, "animate-fade-up")}
              >
                <div className="flex items-start gap-3">
                  <Link to={`/w/${c.slug}`}>
                    <span
                      className="flex h-11 w-11 items-center justify-center rounded-xl text-lg font-bold text-white"
                      style={{ backgroundColor: c.color }}
                    >
                      {c.name[0]}
                    </span>
                  </Link>
                  <div className="min-w-0 flex-1">
                    <Link to={`/w/${c.slug}`} className="font-display font-semibold hover:text-primary">
                      w/{c.slug}
                    </Link>
                    <p className="text-xs text-muted-foreground">
                      {c.memberCount} member{c.memberCount === 1 ? "" : "s"} · {c.postCount} posts
                    </p>
                  </div>
                  {isAuthenticated ? (
                    <Button
                      size="sm"
                      variant={c.joined ? "outline" : "default"}
                      disabled={join.isPending || leave.isPending}
                      onClick={() => (c.joined ? leave.mutate({ communityId: c.id }) : join.mutate({ communityId: c.id }))}
                    >
                      {c.joined ? "Joined" : "Join"}
                    </Button>
                  ) : null}
                </div>
                {c.description ? (
                  <p className="mt-2.5 text-sm text-muted-foreground line-clamp-2">{c.description}</p>
                ) : null}
              </div>
            ))}
      </div>
      {!isLoading && (data ?? []).length === 0 ? (
        <div className="rounded-xl border border-dashed p-10 text-center">
          <Users size={28} className="mx-auto mb-2 text-muted-foreground" />
          <p className="text-sm text-muted-foreground">No communities found{q ? ` for “${q}”` : ""}.</p>
        </div>
      ) : null}
    </div>
  );
}
