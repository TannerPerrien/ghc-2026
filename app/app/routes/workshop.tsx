import { Link } from "react-router";
import type { Route } from "./+types/workshop";
import { getWorkshop, getSpeaker, getTrack } from "~/lib/data";
import { Badge } from "~/components/ui/badge";
import { Button } from "~/components/ui/button";
import { Separator } from "~/components/ui/separator";

export function meta({ data }: Route.MetaArgs) {
  return [{ title: `GHC 2026 — ${data?.workshop.title ?? "Workshop"}` }];
}

export function loader({ params }: Route.LoaderArgs) {
  const workshop = getWorkshop(params.workshop, params.location);
  const speaker = workshop.speakerSlug ? getSpeaker(workshop.speakerSlug, params.location) : null;
  const track = workshop.trackSlug ? getTrack(workshop.trackSlug) : null;
  return { workshop, speaker, track };
}

export default function WorkshopPage({ loaderData, params }: Route.ComponentProps) {
  const { workshop, speaker, track } = loaderData;
  const { scheduleEntry } = workshop;

  return (
    <div className="container mx-auto px-4 py-8 max-w-3xl">
      <div className="mb-6">
        <Link to={`/${params.location}`} className="text-sm text-muted-foreground hover:text-foreground transition-colors">
          ← Back to Schedule
        </Link>
      </div>

      <div className="space-y-4">
        <div>
          {track && <Badge variant="secondary" className="mb-2">{track.name}</Badge>}
          <h1 className="text-2xl font-bold leading-tight">{workshop.title}</h1>
        </div>

        <div className="flex flex-wrap gap-x-6 gap-y-1 text-sm text-muted-foreground">
          <span>{scheduleEntry.day}, {scheduleEntry.date}</span>
          <span>{formatTime(scheduleEntry.startTime)} – {formatTime(scheduleEntry.endTime)}</span>
          <span>{scheduleEntry.room}</span>
        </div>

        {speaker && (
          <>
            <Separator />
            <div className="flex items-center justify-between">
              <div>
                <div className="text-sm text-muted-foreground">Speaker</div>
                <Link
                  to={`/${params.location}/speakers/${speaker.slug}`}
                  className="font-medium hover:underline"
                >
                  {speaker.name}
                </Link>
                {speaker.title && (
                  <div className="text-sm text-muted-foreground">{speaker.title}</div>
                )}
              </div>
              <Button variant="outline" size="sm" asChild>
                <Link to={`/${params.location}/speakers/${speaker.slug}`}>View Speaker</Link>
              </Button>
            </div>
          </>
        )}

        {workshop.description && (
          <>
            <Separator />
            <div
              className="prose prose-sm max-w-none text-foreground"
              dangerouslySetInnerHTML={{ __html: workshop.description }}
            />
          </>
        )}
      </div>
    </div>
  );
}

function formatTime(time: string): string {
  const [h, m] = time.split(":").map(Number);
  const period = h >= 12 ? "PM" : "AM";
  const hour = h % 12 || 12;
  return m === 0 ? `${hour} ${period}` : `${hour}:${m.toString().padStart(2, "0")} ${period}`;
}
