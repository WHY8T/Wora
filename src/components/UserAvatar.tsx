import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { initials } from "@/lib/format";
import { cn } from "@/lib/utils";

type Props = {
  name?: string | null;
  avatar?: string | null;
  className?: string;
};

export function UserAvatar({ name, avatar, className }: Props) {
  return (
    <Avatar className={cn("h-9 w-9", className)}>
      {avatar ? <AvatarImage src={avatar} alt={name ?? "user"} /> : null}
      <AvatarFallback className="bg-primary/15 text-primary text-xs font-semibold">
        {initials(name)}
      </AvatarFallback>
    </Avatar>
  );
}
