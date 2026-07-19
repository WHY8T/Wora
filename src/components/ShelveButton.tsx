import { Check, ChevronDown, LibraryBig, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { trpc } from "@/providers/trpc";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

type Props = {
  externalId: string;
  compact?: boolean;
  className?: string;
};

/** "Add to shelf" dropdown for any book. */
export function ShelveButton({ externalId, compact, className }: Props) {
  const { isAuthenticated } = useAuth();
  const utils = trpc.useUtils();
  const { data: shelves } = trpc.shelves.mine.useQuery(undefined, {
    enabled: isAuthenticated,
  });

  const current = shelves?.find((s) => s.items.some((i) => i.book.externalId === externalId));

  const add = trpc.shelves.add.useMutation({
    onSuccess: (_d, vars) => {
      const shelf = shelves?.find((s) => s.id === vars.shelfId);
      toast.success(`Added to ${shelf?.name ?? "shelf"}`);
      utils.shelves.mine.invalidate();
    },
    onError: (e) => toast.error(e.message),
  });

  const remove = trpc.shelves.remove.useMutation({
    onSuccess: () => {
      toast("Removed from shelf");
      utils.shelves.mine.invalidate();
    },
  });

  const onPick = (shelfId: number, bookId?: number) => {
    if (!isAuthenticated) {
      toast("Sign in to add books to your shelves");
      return;
    }
    if (current?.id === shelfId && bookId) {
      remove.mutate({ shelfId, bookId });
    } else {
      add.mutate({ externalId, shelfId });
    }
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant={current ? "secondary" : "default"}
          size={compact ? "sm" : "default"}
          className={cn("gap-1.5", className)}
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
          }}
        >
          {current ? <Check size={16} /> : <Plus size={16} />}
          {current ? current.name : "Shelve"}
          <ChevronDown size={14} className="opacity-60" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-56">
        <DropdownMenuLabel className="flex items-center gap-2">
          <LibraryBig size={14} /> Add to a shelf
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        {(shelves ?? []).map((s) => {
          const item = s.items.find((i) => i.book.externalId === externalId);
          return (
            <DropdownMenuItem key={s.id} onClick={() => onPick(s.id, item?.bookId)}>
              <span className="flex-1">{s.name}</span>
              {item ? <Check size={14} className="text-primary" /> : null}
            </DropdownMenuItem>
          );
        })}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
