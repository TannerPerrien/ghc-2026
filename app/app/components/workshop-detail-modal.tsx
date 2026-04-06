import { Plus, ExternalLink } from "lucide-react";
import { Link } from "react-router";
import { Button } from "~/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "~/components/ui/dialog";
import { TrackBadge } from "~/components/track-badge";
import type { SelectionType, WorkshopWithSchedule } from "~/lib/types";

interface WorkshopDetailModalProps {
  locationSlug: string;
  workshop: WorkshopWithSchedule | null;
  selectionType: SelectionType | null;
  onClose: () => void;
  onAdd: () => void;
  onRemove: () => void;
  onClickSpeaker: () => void;
}

function formatTime(time: string): string {
  const [h, m] = time.split(":").map(Number);
  const period = h >= 12 ? "PM" : "AM";
  const hour = h % 12 || 12;
  return m === 0 ? `${hour} ${period}` : `${hour}:${m.toString().padStart(2, "0")} ${period}`;
}

export function WorkshopDetailModal({
  locationSlug,
  workshop,
  selectionType,
  onClose,
  onAdd,
  onRemove,
  onClickSpeaker,
}: WorkshopDetailModalProps) {
  if (!workshop) return null;
  const { scheduleEntry } = workshop;

  return (
    <Dialog open={!!workshop} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <div className="pr-8">
            {workshop.trackSlug && (
              <TrackBadge trackSlug={workshop.trackSlug} className="mb-2" />
            )}
            <DialogTitle className="text-lg leading-snug">
              <Link
                to={`/${locationSlug}/workshops/${workshop.slug}`}
                className="hover:underline inline-flex items-center gap-1.5"
                onClick={onClose}
              >
                {workshop.title}
                <ExternalLink className="size-3.5 shrink-0 text-muted-foreground" />
              </Link>
            </DialogTitle>
          </div>
        </DialogHeader>

        {/* Schedule meta */}
        <div className="flex flex-wrap gap-x-4 gap-y-1 text-sm text-muted-foreground -mt-1">
          <span>{scheduleEntry.day}</span>
          <span>{formatTime(scheduleEntry.startTime)}–{formatTime(scheduleEntry.endTime)}</span>
          <span>{scheduleEntry.room}</span>
        </div>

        {/* Speaker */}
        {workshop.speakerName && (
          <div className="text-sm">
            <span className="text-muted-foreground">Speaker: </span>
            <button onClick={onClickSpeaker} className="font-medium hover:underline">
              {workshop.speakerName}
            </button>
          </div>
        )}

        {/* Description */}
        {workshop.description && (
          <div
            className="prose prose-sm max-w-none text-foreground text-sm border-t pt-3 mt-1"
            dangerouslySetInnerHTML={{ __html: workshop.description }}
          />
        )}

        {/* Footer actions */}
        <div className="flex items-center justify-between gap-2 border-t pt-3 mt-1">
          <div className="text-xs text-muted-foreground">
            {selectionType && (
              <span className="font-medium text-foreground capitalize">{selectionType} selection</span>
            )}
          </div>
          <div className="flex gap-2">
            {selectionType ? (
              <Button variant="destructive" size="sm" onClick={() => { onRemove(); onClose(); }}>
                Remove from schedule
              </Button>
            ) : (
              <Button size="sm" onClick={() => { onAdd(); onClose(); }}>
                <Plus className="size-3.5 mr-1.5" />
                Add to schedule
              </Button>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
