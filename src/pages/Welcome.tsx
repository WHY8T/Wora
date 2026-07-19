import { useRef, useState } from "react";
import { useNavigate } from "react-router";
import { BookOpenText, Camera, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { trpc } from "@/providers/trpc";
import { useAuth } from "@/hooks/useAuth";
import { GENRES } from "@contracts/constants";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { fileToAvatarDataUrl } from "@/lib/image";
import { UserAvatar } from "@/components/UserAvatar";

export default function Welcome() {
  const { user } = useAuth({ redirectOnUnauthenticated: true });
  const navigate = useNavigate();
  const utils = trpc.useUtils();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [username, setUsername] = useState("");
  const [genres, setGenres] = useState<string[]>([]);
  const [avatar, setAvatar] = useState<string | null>(null);
  const [avatarError, setAvatarError] = useState<string | null>(null);

  const updateProfile = trpc.profile.update.useMutation();

  const setup = trpc.profile.setup.useMutation({
    onSuccess: async () => {
      if (avatar) {
        try {
          await updateProfile.mutateAsync({ avatar });
        } catch {
          // Username was already claimed; don't block entry over the avatar.
        }
      }
      await utils.profile.me.invalidate();
      toast.success("Welcome to Wora!");
      navigate("/");
    },
    onError: (e) => toast.error(e.message),
  });

  const handleAvatarPick = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    setAvatarError(null);
    try {
      const dataUrl = await fileToAvatarDataUrl(file);
      setAvatar(dataUrl);
    } catch (err) {
      setAvatarError(err instanceof Error ? err.message : "Couldn't use that image");
    }
  };

  const toggleGenre = (g: string) =>
    setGenres((prev) => (prev.includes(g) ? prev.filter((x) => x !== g) : [...prev, g]));

  const valid = /^[a-z0-9_]{3,24}$/.test(username);

  return (
    <div className="flex min-h-screen items-center justify-center p-4">
      <div className="w-full max-w-lg animate-fade-up">
        <div className="mb-8 text-center">
          <span className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-primary text-primary-foreground">
            <BookOpenText size={28} />
          </span>
          <h1 className="font-display text-3xl font-semibold">Welcome to Wora</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Hi {user?.name?.split(" ")[0] ?? "reader"} — claim your username and tell us what you love to read.
          </p>
        </div>

        <div className="space-y-6 rounded-2xl border bg-card p-6">
          <div className="flex flex-col items-center gap-2">
            <div className="relative">
              <UserAvatar name={user?.name} avatar={avatar} className="h-20 w-20" />
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="absolute -bottom-1 -right-1 flex h-7 w-7 items-center justify-center rounded-full border bg-background shadow-sm hover:bg-secondary"
                aria-label="Add profile picture"
              >
                <Camera size={14} />
              </button>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={handleAvatarPick}
              />
            </div>
            <p className="text-xs text-muted-foreground">
              {avatar ? "Looks great." : "Add a profile picture (optional)"}
            </p>
            {avatarError && <p className="text-xs text-destructive">{avatarError}</p>}
          </div>

          <div>
            <label className="mb-1.5 block text-sm font-medium">Username</label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">@</span>
              <Input
                value={username}
                onChange={(e) => setUsername(e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, ""))}
                placeholder="bookworm42"
                className="pl-7"
                maxLength={24}
              />
            </div>
            <p className="mt-1 text-xs text-muted-foreground">
              3–24 characters: lowercase letters, numbers, underscores.
            </p>
          </div>

          <div>
            <label className="mb-1.5 block text-sm font-medium">Favorite genres</label>
            <div className="flex flex-wrap gap-2">
              {GENRES.map((g) => {
                const active = genres.includes(g);
                return (
                  <Badge
                    key={g}
                    variant={active ? "default" : "outline"}
                    className={cn("cursor-pointer select-none gap-1 px-3 py-1.5", active && "shadow-sm")}
                    onClick={() => toggleGenre(g)}
                  >
                    {active ? <Check size={12} /> : null}
                    {g}
                  </Badge>
                );
              })}
            </div>
          </div>

          <Button
            className="w-full"
            size="lg"
            disabled={!valid || setup.isPending || updateProfile.isPending}
            onClick={() => setup.mutate({ username, genres: genres as any })}
          >
            {setup.isPending || updateProfile.isPending ? "Setting up…" : "Start reading"}
          </Button>
        </div>
      </div>
    </div>
  );
}
