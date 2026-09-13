import { useEffect, useRef, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import { UserAvatar } from "@/components/UserAvatar";
import { AvatarPicker } from "@/components/AvatarPicker";
import { trpc } from "@/providers/trpc";
import { useAuth } from "@/hooks/useAuth";
import { GENRES } from "@contracts/constants";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { Check, ImagePlus } from "lucide-react";
import { resizeImageToDataUrl } from "@/lib/image";

export default function Settings() {
  const { user } = useAuth();
  const { data: me, isLoading } = trpc.profile.me.useQuery(undefined, { enabled: !!user });
  const utils = trpc.useUtils();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);

  const [name, setName] = useState("");
  const [bio, setBio] = useState("");
  const [avatar, setAvatar] = useState("");
  const [genres, setGenres] = useState<string[]>([]);
  const [readingGoal, setReadingGoal] = useState(12);
  const [discordUsername, setDiscordUsername] = useState("");
  const [spotifyUrl, setSpotifyUrl] = useState("");

  useEffect(() => {
    if (me) {
      setName(me.user.name ?? "");
      setAvatar(me.user.avatar ?? "");
      setBio(me.profile?.bio ?? "");
      setReadingGoal(me.profile?.readingGoal ?? 12);
      setDiscordUsername(me.profile?.discordUsername ?? "");
      setSpotifyUrl(me.profile?.spotifyUrl ?? "");
      try {
        setGenres(JSON.parse(me.profile?.genres ?? "[]"));
      } catch {
        setGenres([]);
      }
    }
  }, [me]);

  const update = trpc.profile.update.useMutation({
    onSuccess: async () => {
      await utils.profile.me.invalidate();
      await utils.auth.me.invalidate();
      toast.success("Profile updated");
    },
    onError: (e) => toast.error(e.message),
  });

  const uploadAvatar = trpc.profile.uploadAvatar.useMutation({
    onError: (e) => toast.error(e.message),
  });

  const handleFileSelected = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      toast.error("Please choose an image file.");
      return;
    }
    setUploading(true);
    try {
      const dataUrl = await resizeImageToDataUrl(file);
      const result = await uploadAvatar.mutateAsync({ dataUrl });
      setAvatar(result.url);
      toast.success("Photo uploaded — hit Save to keep it");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Upload failed");
    } finally {
      setUploading(false);
    }
  };

  if (isLoading) {
    return (
      <div className="mx-auto max-w-2xl space-y-4">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-64 rounded-xl" />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-2xl animate-fade-up">
      <h1 className="font-display text-2xl font-semibold">Settings</h1>
      <p className="text-sm text-muted-foreground">Tune your reading identity.</p>

      <div className="mt-6 space-y-5 rounded-2xl border bg-card p-5 sm:p-6">
        <div className="space-y-1.5">
          <Label>Username</Label>
          <Input value={`@${me?.profile?.username ?? ""}`} disabled className="bg-secondary/50" />
          <p className="text-xs text-muted-foreground">Usernames can't be changed after setup.</p>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="name">Display name</Label>
          <Input id="name" value={name} onChange={(e) => setName(e.target.value)} maxLength={80} />
        </div>
        <div className="space-y-2">
          <Label>Avatar</Label>
          <div className="flex items-center gap-4">
            <UserAvatar name={name} avatar={avatar} className="h-16 w-16 text-xl" />
            <div className="flex flex-col gap-2">
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={handleFileSelected}
              />
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={uploading}
                onClick={() => fileInputRef.current?.click()}
              >
                <ImagePlus size={14} className="mr-1.5" />
                {uploading ? "Uploading…" : "Upload a photo"}
              </Button>
              <p className="text-xs text-muted-foreground">JPEG or PNG, resized automatically</p>
            </div>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="avatar" className="text-xs text-muted-foreground">
              Or paste a custom image URL
            </Label>
            <Input
              id="avatar"
              value={avatar}
              onChange={(e) => setAvatar(e.target.value)}
              placeholder="https://…"
            />
          </div>
          <AvatarPicker value={avatar} onChange={setAvatar} />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="bio">Bio</Label>
          <Textarea
            id="bio"
            value={bio}
            onChange={(e) => setBio(e.target.value)}
            rows={3}
            maxLength={500}
            placeholder="What kind of reader are you?"
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="goal">Yearly reading goal</Label>
          <Input
            id="goal"
            type="number"
            min={1}
            max={500}
            value={readingGoal}
            onChange={(e) => setReadingGoal(Number(e.target.value) || 12)}
            className="w-32"
          />
        </div>
        <div className="space-y-2">
          <Label>Favorite genres</Label>
          <div className="flex flex-wrap gap-2">
            {GENRES.map((g) => {
              const active = genres.includes(g);
              return (
                <Badge
                  key={g}
                  variant={active ? "default" : "outline"}
                  className={cn("cursor-pointer select-none gap-1 px-3 py-1.5")}
                  onClick={() =>
                    setGenres((prev) => (active ? prev.filter((x) => x !== g) : [...prev, g]))
                  }
                >
                  {active ? <Check size={12} /> : null}
                  {g}
                </Badge>
              );
            })}
          </div>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="discord">Discord username</Label>
          <Input
            id="discord"
            value={discordUsername}
            onChange={(e) => setDiscordUsername(e.target.value.trim().toLowerCase())}
            placeholder="bookworm.reads"
            maxLength={32}
          />
          <p className="text-xs text-muted-foreground">
            Your Discord username (Settings → My Account in Discord), no @.
          </p>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="spotify">Spotify profile or playlist link</Label>
          <Input
            id="spotify"
            value={spotifyUrl}
            onChange={(e) => setSpotifyUrl(e.target.value.trim())}
            placeholder="https://open.spotify.com/user/…"
          />
        </div>
        <Button
          className="w-full"
          size="lg"
          disabled={update.isPending || !name.trim()}
          onClick={() =>
            update.mutate({
              name: name.trim(),
              bio: bio || undefined,
              avatar: avatar || "",
              genres: genres as any,
              readingGoal,
              discordUsername: discordUsername || "",
              spotifyUrl: spotifyUrl || "",
            })
          }
        >
          {update.isPending ? "Saving…" : "Save changes"}
        </Button>
      </div>
    </div>
  );
}