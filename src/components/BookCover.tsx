import { useState } from "react";
import { coverPalette } from "@/lib/format";
import { cn } from "@/lib/utils";

type Props = {
  cover?: string | null;
  title: string;
  className?: string;
};

/** Book cover image with an elegant generated fallback. */
export function BookCover({ cover, title, className }: Props) {
  const [failed, setFailed] = useState(false);
  const showImage = !!cover && !failed;
  const [c1, c2] = coverPalette(title);

  return (
    <div
      className={cn(
        "relative overflow-hidden rounded-md bg-muted select-none",
        className,
      )}
      style={{ aspectRatio: "2/3" }}
    >
      {showImage ? (
        <img
          src={cover!}
          alt={title}
          loading="lazy"
          onError={() => setFailed(true)}
          className="h-full w-full object-cover"
        />
      ) : (
        <div
          className="flex h-full w-full flex-col justify-between p-3"
          style={{ background: `linear-gradient(150deg, ${c1}, ${c2})` }}
        >
          <div className="h-px w-8 bg-white/40" />
          <p className="font-display text-sm font-semibold leading-snug text-white/95 line-clamp-4">
            {title}
          </p>
          <div className="h-px w-5 bg-white/40" />
        </div>
      )}
    </div>
  );
}
