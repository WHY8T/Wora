import { useState } from "react";
import { Star } from "lucide-react";
import { cn } from "@/lib/utils";

type Props = {
  value: number; // 0..5
  onChange?: (v: number) => void;
  size?: number;
  className?: string;
};

export function RatingStars({ value, onChange, size = 18, className }: Props) {
  const [hover, setHover] = useState(0);
  const interactive = !!onChange;
  const display = hover || value;
  return (
    <div className={cn("flex items-center gap-0.5", className)}>
      {[1, 2, 3, 4, 5].map((i) => (
        <button
          key={i}
          type="button"
          disabled={!interactive}
          onClick={() => onChange?.(i === value ? 0 : i)}
          onMouseEnter={() => interactive && setHover(i)}
          onMouseLeave={() => interactive && setHover(0)}
          className={cn(
            "transition-transform",
            interactive ? "cursor-pointer hover:scale-110" : "cursor-default",
          )}
          aria-label={`${i} star${i > 1 ? "s" : ""}`}
        >
          <Star
            size={size}
            className={cn(
              "transition-colors",
              display >= i
                ? "fill-amber-500 text-amber-500"
                : "fill-transparent text-muted-foreground/40",
            )}
          />
        </button>
      ))}
    </div>
  );
}
