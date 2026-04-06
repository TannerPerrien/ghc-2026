import { Minus, Plus, Users } from "lucide-react";
import { cn } from "~/lib/utils";
import { Button } from "~/components/ui/button";
import { TrackBadge } from "~/components/track-badge";
import type { SelectionType, WorkshopWithSchedule } from "~/lib/types";

interface WorkshopCardProps {
  workshop: WorkshopWithSchedule;
  selectionType: SelectionType | null;
  speakerAppearsElsewhere: boolean;
  onAdd: () => void;
  onRemove: () => void;
  onClickTitle: () => void;
  onClickSpeaker: () => void;
}

export function WorkshopCard({
  workshop,
  selectionType,
  speakerAppearsElsewhere,
  onAdd,
  onRemove,
  onClickTitle,
  onClickSpeaker,
}: WorkshopCardProps) {
  const isPrimary = selectionType === "primary";
  const isSecondary = selectionType === "secondary";

  return (
    <div
      className={cn(
        "rounded-md border bg-background p-3 text-sm transition-all hover:bg-accent/20",
        isPrimary && "border-l-4 border-l-primary",
        isSecondary && "border-l-4 border-l-neutral-400 text-muted-foreground"
      )}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          {/* Track badge */}
          {workshop.trackSlug && (
            <TrackBadge trackSlug={workshop.trackSlug} size="sm" className="mb-1" />
          )}

          {/* Title */}
          <button
            onClick={onClickTitle}
            className="text-left font-medium leading-snug hover:underline line-clamp-2 w-full"
          >
            {workshop.title}
          </button>

          {/* Meta row */}
          <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs text-muted-foreground">
            {workshop.speakerName && (
              <button onClick={onClickSpeaker} className="hover:underline flex items-center gap-1">
                {workshop.speakerName}
              </button>
            )}
            <span>{workshop.scheduleEntry.room}</span>
            {speakerAppearsElsewhere && (
              <span className="inline-flex items-center gap-1 text-blue-600">
                <Users className="size-3" />
                Speaker in multiple slots
              </span>
            )}
          </div>
        </div>

        {/* Action buttons */}
        <div className="flex items-center gap-1 shrink-0">
          {selectionType ? (
            <Button
              variant="ghost"
              size="icon"
              className="size-7 text-muted-foreground hover:text-destructive"
              onClick={onRemove}
              title="Remove from schedule"
            >
              <Minus className="size-3.5" />
            </Button>
          ) : (
            <Button
              variant="ghost"
              size="icon"
              className="size-7 text-muted-foreground hover:text-primary"
              onClick={onAdd}
              title="Add to schedule"
            >
              <Plus className="size-3.5" />
            </Button>
          )}
        </div>
      </div>

      {/* Selection label */}
      {selectionType && (
        <div className="mt-1.5">
          <span
            className={cn(
              "text-[10px] font-medium px-1.5 py-0.5 rounded",
              isPrimary
                ? "bg-primary/10 text-primary"
                : "bg-muted text-muted-foreground"
            )}
          >
            {isPrimary ? "Primary" : "Interested"}
          </span>
        </div>
      )}
    </div>
  );
}
