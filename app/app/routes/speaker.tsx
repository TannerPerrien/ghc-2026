import { Link } from "react-router";
import type { Route } from "./+types/speaker";
import { getSpeaker, getWorkshopsForLocation, getTrack } from "~/lib/data";
import { Badge } from "~/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "~/components/ui/avatar";
import { Separator } from "~/components/ui/separator";
import { Card, CardContent } from "~/components/ui/card";

import { SPEAKER_PHOTO_BASE_URL } from "~/lib/data";

export function meta({ data }: Route.MetaArgs) {
  return [{ title: `GHC 2026 — ${data?.speaker.name ?? "Speaker"}` }];
}

export function loader({ params }: Route.LoaderArgs) {
  const speaker = getSpeaker(params.speaker, params.location);
  const allWorkshops = getWorkshopsForLocation(params.location);
  const speakerWorkshops = allWorkshops.filter((w) => w.speakerSlug === speaker.slug);
  return { speaker, speakerWorkshops };
}

export default function SpeakerPage({ loaderData, params }: Route.ComponentProps) {
  const { speaker, speakerWorkshops } = loaderData;

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
    <div className="container mx-auto px-4 py-8 max-w-3xl">
      <div className="mb-6">
        <Link to={`/${params.location}`} className="text-sm text-muted-foreground hover:text-foreground transition-colors">
          ← Back to Schedule
        </Link>
      </div>

      <div className="space-y-6">
        {/* Speaker header */}
        <div className="flex gap-4 items-start">
          <Avatar className="h-20 w-20 shrink-0">
            {photoUrl && <AvatarImage src={photoUrl} alt={speaker.name} />}
            <AvatarFallback className="text-lg">{initials}</AvatarFallback>
          </Avatar>
          <div>
            <h1 className="text-2xl font-bold">{speaker.name}</h1>
            {speaker.title && (
              <p className="text-muted-foreground">{speaker.title}</p>
            )}
            {speaker.website && (
              <a
                href={speaker.website}
                target="_blank"
                rel="noopener noreferrer"
                className="text-sm text-primary hover:underline mt-1 block"
              >
                {speaker.website}
              </a>
            )}
          </div>
        </div>

        {/* Bio */}
        {speaker.bio && (
          <>
            <Separator />
            <div
              className="prose prose-sm max-w-none text-foreground"
              dangerouslySetInnerHTML={{ __html: speaker.bio }}
            />
          </>
        )}

        {/* Workshops */}
        {speakerWorkshops.length > 0 && (
          <>
            <Separator />
            <div>
              <h2 className="font-semibold mb-3">
                Sessions at {params.location.charAt(0).toUpperCase() + params.location.slice(1)} ({speakerWorkshops.length})
              </h2>
              <div className="grid gap-3">
                {speakerWorkshops.map((w) => {
                  const track = w.trackSlug ? getTrack(w.trackSlug) : undefined;
                  return (
                    <Link key={w.slug} to={`/${params.location}/workshops/${w.slug}`}>
                      <Card className="hover:bg-accent/50 transition-colors">
                        <CardContent className="py-3">
                          <div className="flex items-start justify-between gap-2">
                            <div className="min-w-0">
                              {track && (
                                <Badge variant="secondary" className="mb-1 text-xs">{track.name}</Badge>
                              )}
                              <div className="font-medium text-sm line-clamp-2">{w.title}</div>
                              <div className="text-xs text-muted-foreground mt-1 flex gap-3">
                                <span>{w.scheduleEntry.day}</span>
                                <span>{formatTime(w.scheduleEntry.startTime)}</span>
                                <span>{w.scheduleEntry.room}</span>
                              </div>
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    </Link>
                  );
                })}
              </div>
            </div>
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
