import { useEffect, useState } from "react";
import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "~/components/ui/dialog";
import type { SharedSchedule, TimeSlot, WorkshopWithSchedule } from "~/lib/types";

function formatTime(time: string): string {
  const [h, m] = time.split(":").map(Number);
  const period = h >= 12 ? "PM" : "AM";
  const hour = h % 12 || 12;
  return m === 0 ? `${hour} ${period}` : `${hour}:${m.toString().padStart(2, "0")} ${period}`;
}

interface ImportScheduleDialogProps {
  open: boolean;
  schedule: SharedSchedule | null;
  timeSlots: TimeSlot[];
  allWorkshops: WorkshopWithSchedule[];
  onConfirm: (displayName: string | undefined) => void;
  onCancel: () => void;
}

export function ImportScheduleDialog({
  open,
  schedule,
  timeSlots,
  allWorkshops,
  onConfirm,
  onCancel,
}: ImportScheduleDialogProps) {
  const [displayName, setDisplayName] = useState("");

  // Seed label from the schedule's existing displayName when it opens
  useEffect(() => {
    if (schedule) setDisplayName(schedule.displayName ?? "");
  }, [schedule]);

  function handleConfirm() {
    onConfirm(displayName.trim() || undefined);
  }

  return (
    <Dialog open={open} onOpenChange={(open) => !open && onCancel()}>
      <DialogContent className="max-w-lg max-h-[80vh] flex flex-col gap-4">
        <DialogHeader>
          <DialogTitle>Shared Schedule</DialogTitle>
          <DialogDescription>
            Preview this shared schedule and give it a label before adding it to your comparisons.
          </DialogDescription>
        </DialogHeader>

        <div>
          <label className="text-sm font-medium">Label</label>
          <Input
            className="mt-1"
            placeholder="e.g. Alex's Schedule"
            value={displayName}
            onChange={(e) => setDisplayName(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleConfirm()}
            autoFocus
          />
        </div>

        <div className="flex-1 overflow-y-auto divide-y border rounded-md min-h-0">
          {timeSlots.map((slot) => {
            const primary = (schedule?.selections[slot.key] ?? []).find(
              (s) => s.type === "primary"
            );
            const workshop = primary
              ? allWorkshops.find((w) => w.id === primary.workshopId)
              : null;
            if (!workshop) return null;
            return (
              <div key={slot.key} className="flex gap-4 px-3 py-2.5">
                <div className="shrink-0 w-16 text-xs text-muted-foreground leading-snug">
                  <div>{slot.day}</div>
                  <div>{formatTime(slot.startTime)}</div>
                </div>
                <span className="text-sm leading-snug">{workshop.title}</span>
              </div>
            );
          })}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onCancel}>
            Cancel
          </Button>
          <Button onClick={handleConfirm}>Import &amp; Compare</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
