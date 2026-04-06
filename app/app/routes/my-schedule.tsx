import { useEffect, useMemo, useRef } from "react";
import type { Route } from "./+types/my-schedule";
import { getLocation, getSpeakersForLocation, getWorkshopTimeSlots, getWorkshopsForLocation } from "~/lib/data";
import { useSchedule } from "~/contexts/schedule-context";
import { WorkshopModalProvider, useWorkshopModal } from "~/contexts/workshop-modal-context";
import { TrackBadge } from "~/components/track-badge";
import { Button } from "~/components/ui/button";
import { ArrowUp, Printer, Users } from "lucide-react";
import type { ScheduleSelections, WorkshopWithSchedule } from "~/lib/types";
import { ShareButton } from "~/components/share-button";
import { buildSpeakerCount } from "~/lib/schedule";

export function meta({ data }: Route.MetaArgs) {
  return [{ title: `GHC 2026 — ${data?.location.name ?? "My Schedule"}` }];
}

export function loader({ params }: Route.LoaderArgs) {
  const location = getLocation(params.location);
  const timeSlots = getWorkshopTimeSlots(params.location);
  const allWorkshops = getWorkshopsForLocation(params.location);
  const speakers = getSpeakersForLocation(params.location);
  return { location, timeSlots, allWorkshops, speakers };
}

function formatTime(time: string): string {
  const [h, m] = time.split(":").map(Number);
  const period = h >= 12 ? "PM" : "AM";
  const hour = h % 12 || 12;
  return m === 0 ? `${hour} ${period}` : `${hour}:${m.toString().padStart(2, "0")} ${period}`;
}

function getWorkshopsForSlot(
  slotKey: string,
  selections: ScheduleSelections,
  allWorkshops: WorkshopWithSchedule[]
) {
  const slotSelections = selections[slotKey] ?? [];
  const primarySel = slotSelections.find((s) => s.type === "primary");
  const secondarySels = slotSelections.filter((s) => s.type === "secondary");
  return {
    primary: primarySel ? (allWorkshops.find((w) => w.id === primarySel.workshopId) ?? null) : null,
    secondaries: secondarySels
      .map((s) => allWorkshops.find((w) => w.id === s.workshopId))
      .filter(Boolean) as WorkshopWithSchedule[],
  };
}

export default function MySchedulePage({ loaderData }: Route.ComponentProps) {
  const { location, allWorkshops, speakers } = loaderData;

  return (
    <WorkshopModalProvider locationSlug={location.slug} allWorkshops={allWorkshops} speakers={speakers}>
      <MySchedulePageInner loaderData={loaderData} />
    </WorkshopModalProvider>
  );
}

function MySchedulePageInner({ loaderData }: { loaderData: Route.ComponentProps["loaderData"] }) {
  const { location, timeSlots, allWorkshops } = loaderData;
  const { userId, selections, promoteToPrimary } = useSchedule();
  const speakerCounts = useMemo(
    () => buildSpeakerCount(selections, allWorkshops),
    [selections, allWorkshops]
  );
  const { openWorkshopModal, openSpeakerModal } = useWorkshopModal();

  const scrolledRef = useRef(false);

  // Scroll to the current or most recently started time slot.
  // Depends on `selections` so it re-runs after localStorage hydration —
  // rows aren't in the DOM until selections are loaded. The ref prevents
  // re-scrolling on subsequent selection changes.
  useEffect(() => {
    if (scrolledRef.current) return;

    const now = new Date();
    let targetKey: string | null = null;

    for (const slot of timeSlots) {
      const start = new Date(`${slot.date}T${slot.startTime}`);
      const end = new Date(`${slot.date}T${slot.endTime}`);

      if (now >= start && now <= end) {
        targetKey = slot.key;
        break;
      }
      if (start <= now) {
        targetKey = slot.key;
      }
    }

    if (!targetKey) return;

    const el = document.getElementById(`slot-${targetKey}`);
    if (!el) return; // rows not yet rendered (pre-hydration) — will retry after selections load

    const headerHeight = document.querySelector("header")?.offsetHeight ?? 57;
    window.scrollTo({ top: el.getBoundingClientRect().top + window.scrollY - headerHeight, behavior: "instant" });
    scrolledRef.current = true;
  }, [timeSlots, selections]);

  const scheduledSlots = timeSlots.filter((slot) => (selections[slot.key] ?? []).length > 0);

  return (
    <div className="min-h-[calc(100vh-57px)] flex flex-col w-full">
      {/* Screen header */}
      <div className="flex items-center justify-between px-6 py-4 border-b shrink-0 print:hidden">
        <h1 className="font-semibold text-sm">My Schedule</h1>
        <div className="flex items-center gap-2">
          <ShareButton userId={userId} locationSlug={location.slug} schedule={selections} />
          <Button variant="outline" size="sm" onClick={() => window.print()} className="gap-1.5">
            <Printer className="size-3.5" />
            Print
          </Button>
        </div>
      </div>

      {/* Print-only heading */}
      <div className="hidden print:block px-8 py-6 border-b">
        <p className="text-xs text-muted-foreground uppercase tracking-wide mb-1">GHC 2026</p>
        <h1 className="text-2xl font-bold">{location.name} — My Schedule</h1>
      </div>

      {scheduledSlots.length === 0 ? (
        <div className="flex-1 flex flex-col items-center justify-center gap-2 text-center px-8 print:hidden">
          <p className="text-sm font-medium">Your schedule is empty</p>
          <p className="text-sm text-muted-foreground">
            Head to Workshops to start adding sessions.
          </p>
        </div>
      ) : (
        <div className="overflow-hidden w-full">
        <table className="w-full border-collapse">
          <tbody>
            {scheduledSlots.map((slot) => {
              const { primary, secondaries } = getWorkshopsForSlot(slot.key, selections, allWorkshops);

              return (
                <tr
                  key={slot.key}
                  id={`slot-${slot.key}`}
                  className="border-b align-top"
                >
                  <td className="w-40 px-6 py-5 text-sm text-muted-foreground whitespace-nowrap align-top shrink-0">
                    <div className="font-medium text-foreground">{slot.day}</div>
                    <div>{formatTime(slot.startTime)}</div>
                    <div className="text-xs">– {formatTime(slot.endTime)}</div>
                  </td>
                  <td className="px-6 py-5 align-top">
                    {primary && (
                      <div>
                        {primary.trackSlug && (
                          <TrackBadge trackSlug={primary.trackSlug} size="sm" className="mb-1.5" />
                        )}
                        <button
                          onClick={() => openWorkshopModal(primary)}
                          className="font-medium leading-snug hover:underline text-left"
                        >
                          {primary.title}
                        </button>
                        <div className="text-sm text-muted-foreground mt-1 flex flex-wrap gap-x-3">
                          {primary.speakerName && (
                            <button
                              onClick={() => openSpeakerModal(primary.speakerSlug)}
                              className="hover:underline"
                            >
                              {primary.speakerName}
                            </button>
                          )}
                          <span>{primary.scheduleEntry.room}</span>
                          {(() => {
                            const count = primary.speakerSlug
                              ? (speakerCounts.get(primary.speakerSlug) ?? 0)
                              : 0;
                            return count > 1 ? (
                              <span className="inline-flex items-center gap-1 text-blue-600">
                                <Users className="size-3" />
                                In {count} workshops with speaker
                              </span>
                            ) : null;
                          })()}
                        </div>
                      </div>
                    )}
                    {secondaries.length > 0 && (
                      <div className="mt-4 space-y-2.5">
                        <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                          Also interested
                        </p>
                        {secondaries.map((w) => (
                          <div key={w.id} className="flex items-start gap-1">
                            <Button
                              variant="ghost"
                              size="icon"
                              className="size-6 shrink-0 text-muted-foreground hover:text-primary print:hidden mt-0.5"
                              onClick={() => promoteToPrimary(slot.key, w.id)}
                              title="Promote to primary"
                            >
                              <ArrowUp className="size-3.5" />
                            </Button>
                            <div className="text-sm text-muted-foreground">
                              <button
                                onClick={() => openWorkshopModal(w)}
                                className="leading-snug hover:underline text-left"
                              >
                                {w.title}
                              </button>
                              <div className="text-xs text-muted-foreground/70 mt-0.5 flex flex-wrap gap-x-3">
                                {w.speakerName && (
                                  <button
                                    onClick={() => openSpeakerModal(w.speakerSlug)}
                                    className="hover:underline"
                                  >
                                    {w.speakerName}
                                  </button>
                                )}
                                <span>{w.scheduleEntry.room}</span>
                                {(() => {
                                  const count = w.speakerSlug
                                    ? (speakerCounts.get(w.speakerSlug) ?? 0)
                                    : 0;
                                  return count > 1 ? (
                                    <span className="inline-flex items-center gap-1 text-blue-600">
                                      <Users className="size-3" />
                                      In {count} workshops with speaker
                                    </span>
                                  ) : null;
                                })()}
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
        </div>
      )}
    </div>
  );
}
