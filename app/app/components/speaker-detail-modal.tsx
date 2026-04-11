import { ExternalLink } from "lucide-react";
import { Link } from "react-router";
import { Button } from "~/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "~/components/ui/dialog";
import { Avatar, AvatarFallback, AvatarImage } from "~/components/ui/avatar";
import { TrackBadge } from "~/components/track-badge";
import type { Speaker, WorkshopWithSchedule } from "~/lib/types";

import { SPEAKER_PHOTO_BASE_URL } from "~/lib/data";

interface SpeakerDetailModalProps {
  speaker: Speaker | null;
  speakerWorkshops: WorkshopWithSchedule[];
  onClose: () => void;
  onClickWorkshop: (workshop: WorkshopWithSchedule) => void;
}

function formatTime(time: string): string {
  const [h, m] = time.split(":").map(Number);
  const period = h >= 12 ? "PM" : "AM";
  const hour = h % 12 || 12;
  return m === 0 ? `${hour} ${period}` : `${hour}:${m.toString().padStart(2, "0")} ${period}`;
}

export function SpeakerDetailModal({
  speaker,
  speakerWorkshops,
  onClose,
  onClickWorkshop,
}: SpeakerDetailModalProps) {
  if (!speaker) return null;

  const initials = speaker.name
    .split(" ")
    .map((p) => p[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

  const photoUrl = speaker.photoFilename
    ? `${SPEAKER_PHOTO_BASE_URL}${speaker.photoFilename}`
    : undefined;

  return (
    <Dialog open={!!speaker} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-lg max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <div className="flex gap-4 items-start pr-8">
            <Avatar className="h-14 w-14 shrink-0">
              {photoUrl && <AvatarImage src={photoUrl} alt={speaker.name} />}
              <AvatarFallback>{initials}</AvatarFallback>
            </Avatar>
            <div className="min-w-0">
              <DialogTitle className="text-lg">
                <Link
                  to={`/speakers/${speaker.slug}`}
                  className="hover:underline inline-flex items-center gap-1.5"
                  onClick={onClose}
                >
                  {speaker.name}
                  <ExternalLink className="size-3.5 shrink-0 text-muted-foreground" />
                </Link>
              </DialogTitle>
              {speaker.title && (
                <p className="text-sm text-muted-foreground">{speaker.title}</p>
              )}
              {speaker.website && (
                <a
                  href={speaker.website}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-xs text-primary hover:underline mt-0.5 block truncate"
                >
                  {speaker.website}
                </a>
              )}
            </div>
          </div>
        </DialogHeader>

        {/* Bio */}
        {speaker.bio && (
          <div
            className="prose prose-sm max-w-none text-foreground text-sm border-t pt-3"
            dangerouslySetInnerHTML={{ __html: speaker.bio }}
          />
        )}

        {/* Workshops */}
        {speakerWorkshops.length > 0 && (
          <div className="border-t pt-3">
            <h3 className="text-sm font-semibold mb-2">Sessions ({speakerWorkshops.length})</h3>
            <div className="space-y-2">
              {speakerWorkshops.map((w) => (
                <button
                  key={w.id}
                  onClick={() => onClickWorkshop(w)}
                  className="w-full text-left rounded-md border p-2.5 text-xs hover:bg-accent/30 transition-colors"
                >
                  {w.trackSlug && <TrackBadge trackSlug={w.trackSlug} size="sm" className="mb-1" />}
                  <div className="font-medium leading-snug">{w.title}</div>
                  <div className="text-muted-foreground mt-0.5 flex gap-2">
                    <span>{w.scheduleEntry.day}</span>
                    <span>{formatTime(w.scheduleEntry.startTime)}</span>
                    <span>{w.scheduleEntry.room}</span>
                  </div>
                </button>
              ))}
            </div>
          </div>
        )}

      </DialogContent>
    </Dialog>
  );
}
