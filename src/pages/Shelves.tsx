import { useState } from "react";
import { Link } from "react-router";
import { LibraryBig, Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { trpc } from "@/providers/trpc";
import { BookCover } from "@/components/BookCover";
import { toast } from "sonner";
import { timeAgo } from "@/lib/format";

export default function Shelves() {
  const { data: shelves, isLoading } = trpc.shelves.mine.useQuery();
  const [newName, setNewName] = useState("");
  const [open, setOpen] = useState(false);
  const utils = trpc.useUtils();

  const createShelf = trpc.shelves.createShelf.useMutation({
    onSuccess: () => {
      utils.shelves.mine.invalidate();
      setOpen(false);
      setNewName("");
      toast.success("Shelf created");
    },
  });
  const remove = trpc.shelves.remove.useMutation({
    onSuccess: () => {
      utils.shelves.mine.invalidate();
      toast("Removed from shelf");
    },
  });
  const add = trpc.shelves.add.useMutation({
    onSuccess: () => {
      utils.shelves.mine.invalidate();
      toast.success("Moved");
    },
  });

  if (isLoading) {
    return (
      <div className="mx-auto max-w-5xl space-y-4">
        <Skeleton className="h-10 w-72" />
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-4 md:grid-cols-5">
          {Array.from({ length: 5 }).map((_, i) => (
            <Skeleton key={i} className="aspect-[2/3] rounded-md" />
          ))}
        </div>
      </div>
    );
  }

  const ordered = [...(shelves ?? [])].sort((a, b) => {
    const order = (k: string | null) => (k === "reading" ? 0 : k === "want" ? 1 : k === "finished" ? 2 : 3);
    return order(a.systemKey) - order(b.systemKey);
  });

  return (
    <div className="mx-auto max-w-5xl animate-fade-up">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="font-display text-2xl font-semibold">My shelves</h1>
          <p className="text-sm text-muted-foreground">Your library, organized your way.</p>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button variant="outline" className="gap-1.5">
              <Plus size={15} /> New shelf
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle className="font-display">Create a custom shelf</DialogTitle>
            </DialogHeader>
            <div className="space-y-3">
              <Input
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                placeholder="e.g. Beach reads, Book club picks…"
                maxLength={64}
              />
              <Button
                className="w-full"
                disabled={!newName.trim() || createShelf.isPending}
                onClick={() => createShelf.mutate({ name: newName.trim() })}
              >
                Create shelf
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      <Tabs defaultValue={ordered[0]?.id.toString()}>
        <TabsList className="mb-5 flex-wrap">
          {ordered.map((s) => (
            <TabsTrigger key={s.id} value={s.id.toString()}>
              {s.name}
              <span className="ml-1.5 rounded-full bg-secondary px-1.5 text-[10px] text-muted-foreground">
                {s.items.length}
              </span>
            </TabsTrigger>
          ))}
        </TabsList>
        {ordered.map((s) => (
          <TabsContent key={s.id} value={s.id.toString()}>
            {s.items.length === 0 ? (
              <div className="rounded-xl border border-dashed p-10 text-center">
                <LibraryBig size={28} className="mx-auto mb-2 text-muted-foreground" />
                <p className="text-sm text-muted-foreground">
                  Nothing here yet.{" "}
                  <Link to="/search" className="font-medium text-primary hover:underline">
                    Find a book
                  </Link>{" "}
                  and shelve it.
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-x-4 gap-y-7 sm:grid-cols-4 md:grid-cols-5">
                {s.items.map((i) => (
                  <div key={i.id} className="group relative">
                    <Link to={`/book/${encodeURIComponent(i.book.externalId)}`}>
                      <BookCover
                        cover={i.book.cover}
                        title={i.book.title}
                        className="w-full shadow-md transition-transform group-hover:-translate-y-1"
                      />
                    </Link>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <button className="absolute right-1.5 top-1.5 rounded-md bg-background/80 p-1 text-muted-foreground opacity-0 backdrop-blur transition-opacity hover:text-foreground group-hover:opacity-100">
                          <Plus size={14} className="rotate-45" />
                        </button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end" className="w-48">
                        {(shelves ?? [])
                          .filter((x) => x.id !== s.id)
                          .map((x) => (
                            <DropdownMenuItem
                              key={x.id}
                              onClick={() => add.mutate({ externalId: i.book.externalId, shelfId: x.id })}
                            >
                              Move to {x.name}
                            </DropdownMenuItem>
                          ))}
                        <DropdownMenuItem
                          className="gap-2 text-destructive"
                          onClick={() => remove.mutate({ shelfId: s.id, bookId: i.bookId })}
                        >
                          <Trash2 size={13} /> Remove
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                    <Link to={`/book/${encodeURIComponent(i.book.externalId)}`}>
                      <p className="mt-2 truncate text-sm font-medium group-hover:text-primary">{i.book.title}</p>
                      <p className="truncate text-xs text-muted-foreground">
                        {(() => {
                          try {
                            return (JSON.parse(i.book.authors ?? "[]") as string[]).join(", ");
                          } catch {
                            return "";
                          }
                        })()}
                      </p>
                    </Link>
                    <p className="mt-0.5 text-[11px] text-muted-foreground">added {timeAgo(i.createdAt)}</p>
                  </div>
                ))}
              </div>
            )}
          </TabsContent>
        ))}
      </Tabs>
    </div>
  );
}
