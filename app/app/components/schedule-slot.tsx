import { ArrowUp, Minus } from "lucide-react";
import { cn } from "~/lib/utils";
import { Button } from "~/components/ui/button";
import { TrackBadge } from "~/components/track-badge";
import type { WorkshopWithSchedule } from "~/lib/types";

interface ScheduleSlotProps {
  slotKey: string;
  day: string;
  startTime: string;
  endTime: string;
  primaryWorkshop: WorkshopWithSchedule | null;
  secondaryWorkshops: WorkshopWithSchedule[];
  isVisibleInSchedule?: boolean;
  onSlotHeaderClick?: () => void;
  onPromoteToPrimary: (workshopId: string) => void;
  onRemove: (workshopId: string) => void;
  onClickWorkshop: (workshop: WorkshopWithSchedule) => void;
}

function formatTime(time: string): string {
  const [h, m] = time.split(":").map(Number);
  const period = h >= 12 ? "PM" : "AM";
  const hour = h % 12 || 12;
  return m === 0 ? `${hour} ${period}` : `${hour}:${m.toString().padStart(2, "0")} ${period}`;
}

export function slotAnchorId(slotKey: string) {
  return "slot-" + slotKey.replace("|", "-").replace(/:/g, "");
}

export function ScheduleSlot({
  slotKey,
  day,
  startTime,
  endTime,
  primaryWorkshop,
  secondaryWorkshops,
  isVisibleInSchedule,
  onSlotHeaderClick,
  onPromoteToPrimary,
  onRemove,
  onClickWorkshop,
}: ScheduleSlotProps) {
  const hasSelections = primaryWorkshop || secondaryWorkshops.length > 0;

  return (
    <div className="rounded-md border bg-background overflow-hidden">
      {/* Slot header */}
      <div className="px-3 py-2 bg-muted/40 border-b">
        {isVisibleInSchedule ? (
          <a
            href={`#${slotAnchorId(slotKey)}`}
            onClick={onSlotHeaderClick}
            className="text-xs font-medium text-primary hover:underline"
          >
            {day} · {formatTime(startTime)}–{formatTime(endTime)}
          </a>
        ) : (
          <div className="text-xs font-medium text-muted-foreground">
            {day} · {formatTime(startTime)}–{formatTime(endTime)}
          </div>
        )}
      </div>

      {!hasSelections ? (
        <div className="px-3 py-3 text-xs text-muted-foreground italic">
          No selection
        </div>
      ) : (
        <div className="p-2 space-y-1.5">
          {/* Primary selection */}
          {primaryWorkshop && (
            <div
              className={cn(
                "rounded border p-2 text-xs",
                "border-l-4 border-l-primary bg-primary/5"
              )}
            >
              <div className="flex items-start justify-between gap-1">
                <div className="min-w-0 flex-1">
                  <button
                    onClick={() => onClickWorkshop(primaryWorkshop)}
                    className="font-medium leading-snug hover:underline text-left line-clamp-2"
                  >
                    {primaryWorkshop.title}
                  </button>
                  <div className="text-muted-foreground mt-0.5 flex flex-wrap gap-x-2">
                    {primaryWorkshop.speakerName && <span>{primaryWorkshop.speakerName}</span>}
                    <span>{primaryWorkshop.scheduleEntry.room}</span>
                  </div>
                  {primaryWorkshop.trackSlug && (
                    <TrackBadge trackSlug={primaryWorkshop.trackSlug} size="sm" className="mt-1" />
                  )}
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  className="size-5 shrink-0 text-muted-foreground hover:text-destructive"
                  onClick={() => onRemove(primaryWorkshop.id)}
                  title="Remove"
                >
                  <Minus className="size-3" />
                </Button>
              </div>
              <span className="text-[10px] font-medium text-primary mt-1 inline-block">Primary</span>
            </div>
          )}

          {/* Secondary selections */}
          {secondaryWorkshops.map((w) => (
            <div key={w.id} className="rounded border border-dashed p-2 text-xs bg-muted/20">
              <div className="flex items-start justify-between gap-1">
                <div className="min-w-0 flex-1">
                  <button
                    onClick={() => onClickWorkshop(w)}
                    className="font-medium leading-snug hover:underline text-left line-clamp-2 text-muted-foreground"
                  >
                    {w.title}
                  </button>
                  {w.speakerName && (
                    <div className="text-muted-foreground mt-0.5">{w.speakerName}</div>
                  )}
                </div>
                <div className="flex items-center gap-0.5 shrink-0">
                  <Button
                    variant="ghost"
                    size="icon"
                    className="size-5 text-muted-foreground hover:text-primary"
                    onClick={() => onPromoteToPrimary(w.id)}
                    title="Promote to primary"
                  >
                    <ArrowUp className="size-3" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="size-5 text-muted-foreground hover:text-destructive"
                    onClick={() => onRemove(w.id)}
                    title="Remove"
                  >
                    <Minus className="size-3" />
                  </Button>
                </div>
              </div>
              <span className="text-[10px] font-medium text-muted-foreground mt-1 inline-block">Interested</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
