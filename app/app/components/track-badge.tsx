import { cn } from "~/lib/utils";
import { getTrackTheme } from "~/lib/tracks";

interface TrackBadgeProps {
  trackSlug: string | null | undefined;
  className?: string;
  size?: "sm" | "default";
}

export function TrackBadge({ trackSlug, className, size = "default" }: TrackBadgeProps) {
  const theme = getTrackTheme(trackSlug);
  if (!theme) return null;
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full border font-medium",
        size === "sm" ? "px-1.5 py-0.5 text-[10px]" : "px-2 py-0.5 text-xs",
        theme.bg,
        theme.text,
        theme.border,
        className
      )}
    >
      <span className={cn("inline-block rounded-full shrink-0", size === "sm" ? "size-1.5" : "size-2", theme.dot)} />
      {theme.name}
    </span>
  );
}
