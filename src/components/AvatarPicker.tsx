import { Check } from "lucide-react";
import { cn } from "@/lib/utils";

const STYLE = "adventurer";
const SEEDS = ["Willow", "Percy", "Juniper", "Basil", "Ember", "Sage", "Clover", "Rook", "Marlowe", "Fable"];

function urlFor(seed: string) {
    return `https://api.dicebear.com/9.x/${STYLE}/svg?seed=${encodeURIComponent(seed)}&radius=50`;
}

type Props = {
    value: string;
    onChange: (url: string) => void;
};

export function AvatarPicker({ value, onChange }: Props) {
    return (
        <div className="grid grid-cols-5 gap-2.5">
            {SEEDS.map((seed) => {
                const url = urlFor(seed);
                const selected = value === url;
                return (
                    <button
                        key={seed}
                        type="button"
                        onClick={() => onChange(url)}
                        className={cn(
                            "relative aspect-square overflow-hidden rounded-full border-2 transition-all hover:scale-105",
                            selected ? "border-primary ring-2 ring-primary/30" : "border-transparent",
                        )}
                    >
                        <img src={url} alt="" className="h-full w-full bg-secondary" />
                        {selected && (
                            <span className="absolute bottom-0 right-0 flex h-4 w-4 items-center justify-center rounded-full bg-primary text-primary-foreground">
                                <Check size={10} />
                            </span>
                        )}
                    </button>
                );
            })}
        </div>
    );
}