import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router";
import type { Route } from "./+types/schedule";
import {
  getLocation,
  getWorkshopTimeSlots,
  getTracksForLocation,
  getSpeakersForLocation,
  getRoomsForLocation,
  getWorkshopsForLocation,
} from "~/lib/data";
import { useSchedule } from "~/contexts/schedule-context";
import { WorkshopModalProvider, useWorkshopModal } from "~/contexts/workshop-modal-context";
import { decodeSchedule } from "~/lib/sharing";
import { FilterSidebar } from "~/components/filter-sidebar";
import { WorkshopCard } from "~/components/workshop-card";
import { ScheduleSlot, slotAnchorId } from "~/components/schedule-slot";
import { ShareButton } from "~/components/share-button";
import { ResetMenu } from "~/components/reset-menu";
import { Sheet, SheetClose, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "~/components/ui/sheet";
import { Button } from "~/components/ui/button";
import { ImportScheduleDialog } from "~/components/import-schedule-dialog";
import { CalendarDays, SlidersHorizontal, X } from "lucide-react";
import { buildSpeakerCount } from "~/lib/schedule";
import type { FilterState, SharedSchedule, WorkshopWithSchedule } from "~/lib/types";

export function meta({ data }: Route.MetaArgs) {
  return [{ title: `GHC 2026 — ${data?.location.name ?? "Schedule"}` }];
}

export function loader({ params }: Route.LoaderArgs) {
  const location = getLocation(params.location);
  const timeSlots = getWorkshopTimeSlots(params.location);
  const tracks = getTracksForLocation(params.location);
  const speakers = getSpeakersForLocation(params.location);
  const rooms = getRoomsForLocation(params.location);
  const allWorkshops = getWorkshopsForLocation(params.location);
  return { location, timeSlots, tracks, speakers, rooms, allWorkshops };
}

const defaultFilters: FilterState = {
  tracks: new Set(),
  speakers: new Set(),
  rooms: new Set(),
  search: "",
};

function workshopMatchesFilters(w: WorkshopWithSchedule, f: FilterState): boolean {
  if (f.tracks.size > 0 && (!w.trackSlug || !f.tracks.has(w.trackSlug))) return false;
  if (f.speakers.size > 0 && (!w.speakerSlug || !f.speakers.has(w.speakerSlug))) return false;
  if (f.rooms.size > 0 && !f.rooms.has(w.scheduleEntry.room)) return false;
  if (f.search) {
    const q = f.search.toLowerCase();
    const matchesTitle = w.title.toLowerCase().includes(q);
    const matchesSpeaker = !!w.speakerName && w.speakerName.toLowerCase().includes(q);
    const matchesRoom = w.scheduleEntry.room.toLowerCase().includes(q);
    if (!matchesTitle && !matchesSpeaker && !matchesRoom) return false;
  }
  return true;
}

function formatTime(time: string): string {
  const [h, m] = time.split(":").map(Number);
  const period = h >= 12 ? "PM" : "AM";
  const hour = h % 12 || 12;
  return m === 0 ? `${hour} ${period}` : `${hour}:${m.toString().padStart(2, "0")} ${period}`;
}

export default function SchedulePage({ loaderData }: Route.ComponentProps) {
  const { location, allWorkshops, speakers } = loaderData;

  return (
    <WorkshopModalProvider locationSlug={location.slug} allWorkshops={allWorkshops} speakers={speakers}>
      <SchedulePageInner loaderData={loaderData} />
    </WorkshopModalProvider>
  );
}

function SchedulePageInner({ loaderData }: { loaderData: Route.ComponentProps["loaderData"] }) {
  const { location, timeSlots, tracks, speakers, rooms, allWorkshops } = loaderData;
  const {
    userId,
    selections,
    selectWorkshop,
    removeWorkshop,
    promoteToPrimary,
    clearSchedule,
    importSchedule,
  } = useSchedule();
  const { openWorkshopModal, openSpeakerModal } = useWorkshopModal();

  const navigate = useNavigate();
  const [filters, setFilters] = useState<FilterState>(defaultFilters);
  const [scheduleSheetOpen, setScheduleSheetOpen] = useState(false);
  const [pendingShare, setPendingShare] = useState<SharedSchedule | null>(null);

  // Detect ?schedule= query param on mount (deferred until after HYDRATE)
  useEffect(() => {
    if (!userId) return; // userId is "" pre-hydration; re-runs after HYDRATE fires

    const params = new URLSearchParams(window.location.search);
    const scheduleParam = params.get("schedule");
    if (!scheduleParam) return;

    window.history.replaceState({}, "", window.location.pathname); // clean URL first

    try {
      const decoded = decodeSchedule(scheduleParam);
      if (decoded.userId === userId) {
        // Own share link — nothing to do, schedule is already loaded
        return;
      }
      // Foreign schedule — show preview/naming dialog
      setPendingShare(decoded);
    } catch {
      // Malformed share link — ignore silently
    }
  }, [userId, location.slug]);

  function handleImportConfirm(displayName: string | undefined) {
    if (!pendingShare) return;
    importSchedule({ ...pendingShare, displayName });
    setPendingShare(null);
    navigate(`/${location.slug}/compare`);
  }

  // Build map of workshopId -> slotKey + selectionType for quick lookups
  const selectionMap = useMemo(() => {
    const map = new Map<string, { slotKey: string; type: "primary" | "secondary" }>();
    for (const [slotKey, slotSelections] of Object.entries(selections)) {
      for (const sel of slotSelections) {
        map.set(sel.workshopId, { slotKey, type: sel.type });
      }
    }
    return map;
  }, [selections]);

  // Build map of speakerSlug -> number of selected workshops featuring that speaker
  const speakerCount = useMemo(
    () => buildSpeakerCount(selections, allWorkshops),
    [selections, allWorkshops]
  );

  const hasActiveFilters =
    filters.tracks.size > 0 ||
    filters.speakers.size > 0 ||
    filters.rooms.size > 0 ||
    filters.search.length > 0;

  // Which slot keys have at least one workshop passing the current filters
  const visibleSlotKeys = useMemo(() => {
    const keys = new Set<string>();
    for (const slot of timeSlots) {
      const visible = hasActiveFilters
        ? slot.workshops.some((w) => workshopMatchesFilters(w, filters))
        : true;
      if (visible) keys.add(slot.key);
    }
    return keys;
  }, [timeSlots, filters, hasActiveFilters]);

  // Resolve selections for a given slot
  function getSlotWorkshops(slotKey: string) {
    const slotSelections = selections[slotKey] ?? [];
    const primary = slotSelections.find((s) => s.type === "primary");
    const secondaries = slotSelections.filter((s) => s.type === "secondary");

    function resolve(id: string) {
      return allWorkshops.find((w) => w.id === id) ?? null;
    }

    return {
      primaryWorkshop: primary ? resolve(primary.workshopId) : null,
      secondaryWorkshops: secondaries
        .map((s) => resolve(s.workshopId))
        .filter(Boolean) as WorkshopWithSchedule[],
    };
  }

  const filterSidebar = (
    <FilterSidebar
      tracks={tracks}
      speakers={speakers}
      rooms={rooms}
      filters={filters}
      onFiltersChange={setFilters}
    />
  );

  const activeFilterCount =
    filters.tracks.size + filters.speakers.size + filters.rooms.size + (filters.search ? 1 : 0);

  const scheduledSlotCount = Object.values(selections).filter((s) => s.length > 0).length;

  function renderScheduleSidebar(showClose?: boolean, onClose?: () => void) {
    return (
    <div className="flex flex-col h-full overflow-hidden">
      <div className="px-4 py-3 border-b flex items-center justify-between shrink-0">
        <h2 className="font-semibold text-sm uppercase tracking-wide text-muted-foreground">
          My Schedule
        </h2>
        <div className="flex items-center gap-1">
          <ShareButton userId={userId} locationSlug={location.slug} schedule={selections} />
          <ResetMenu onClearSchedule={clearSchedule} />
          {showClose && (
            <SheetClose asChild>
              <Button variant="ghost" size="icon-sm">
                <X className="size-4" />
                <span className="sr-only">Close</span>
              </Button>
            </SheetClose>
          )}
        </div>
      </div>
      <div className="flex-1 overflow-y-auto p-3 space-y-2">
        {timeSlots.map((slot) => {
          const { primaryWorkshop, secondaryWorkshops } = getSlotWorkshops(slot.key);
          return (
            <ScheduleSlot
              key={slot.key}
              slotKey={slot.key}
              day={slot.day}
              startTime={slot.startTime}
              endTime={slot.endTime}
              primaryWorkshop={primaryWorkshop}
              secondaryWorkshops={secondaryWorkshops}
              speakerCounts={speakerCount}
              isVisibleInSchedule={visibleSlotKeys.has(slot.key)}
              onSlotHeaderClick={onClose}
              onPromoteToPrimary={(workshopId) => promoteToPrimary(slot.key, workshopId)}
              onRemove={(workshopId) => removeWorkshop(slot.key, workshopId)}
              onClickWorkshop={openWorkshopModal}
            />
          );
        })}
      </div>
    </div>
    );
  }

  return (
    <>
      <div className="flex h-[calc(100vh-57px)]">
        {/* Left: Filters — desktop only */}
        <aside className="hidden lg:flex w-64 border-r bg-muted/30 p-4 shrink-0 flex-col">
          {filterSidebar}
        </aside>

        {/* Middle: Workshop list */}
        <div className="flex-1 flex flex-col min-h-0">
          {/* Header — outside the scroll area so it never overlaps */}
          <div className="flex items-center justify-between gap-2 px-4 py-3 border-b lg:border-b-0 lg:px-4 lg:pt-4 lg:pb-2 bg-background shrink-0">
            <h2 className="font-semibold text-sm">
              {location.name}
              <span className="font-normal text-muted-foreground ml-2">
                {timeSlots.reduce((n, s) => n + s.workshops.length, 0)} workshops
              </span>
            </h2>

            {/* Mobile: filter + schedule icon buttons */}
            <div className="flex items-center gap-1 lg:hidden">
              <Sheet>
                <SheetTrigger asChild>
                  <Button variant="outline" size="icon" className="size-8 relative">
                    <SlidersHorizontal className="size-4" />
                    {hasActiveFilters && (
                      <span className="absolute -top-1 -right-1 size-4 bg-primary text-primary-foreground rounded-full text-[10px] flex items-center justify-center leading-none">
                        {activeFilterCount}
                      </span>
                    )}
                    <span className="sr-only">Filters</span>
                  </Button>
                </SheetTrigger>
                <SheetContent side="left" className="w-72 flex flex-col p-0">
                  <SheetHeader className="px-4 pt-4 pb-0">
                    <SheetTitle>Filters</SheetTitle>
                  </SheetHeader>
                  <div className="flex-1 min-h-0 p-4">
                    {filterSidebar}
                  </div>
                </SheetContent>
              </Sheet>

              <Sheet open={scheduleSheetOpen} onOpenChange={setScheduleSheetOpen}>
                <SheetTrigger asChild>
                  <Button variant="outline" size="icon" className="size-8 relative">
                    <CalendarDays className="size-4" />
                    {scheduledSlotCount > 0 && (
                      <span className="absolute -top-1 -right-1 size-4 bg-primary text-primary-foreground rounded-full text-[10px] flex items-center justify-center leading-none">
                        {scheduledSlotCount}
                      </span>
                    )}
                    <span className="sr-only">My Schedule</span>
                  </Button>
                </SheetTrigger>
                <SheetContent side="right" className="w-80 flex flex-col p-0" showCloseButton={false}>
                  <SheetHeader className="sr-only">
                    <SheetTitle>My Schedule</SheetTitle>
                  </SheetHeader>
                  {renderScheduleSidebar(true, () => setScheduleSheetOpen(false))}
                </SheetContent>
              </Sheet>
            </div>
          </div>

          {/* Scrollable workshop list */}
          <div className="flex-1 overflow-y-auto px-4 pb-4">
          <div className="space-y-6 pt-2">
            {hasActiveFilters && !timeSlots.some((slot) =>
              slot.workshops.some((w) => workshopMatchesFilters(w, filters))
            ) && (
              <div className="flex flex-col items-center justify-center py-20 text-center text-muted-foreground">
                <p className="text-sm font-medium">No workshops match your filters.</p>
                <p className="text-xs mt-1">Try adjusting or clearing the active filters.</p>
              </div>
            )}
            {timeSlots.map((slot) => {
              const visibleWorkshops = hasActiveFilters
                ? slot.workshops.filter((w) => workshopMatchesFilters(w, filters))
                : slot.workshops;

              if (visibleWorkshops.length === 0) return null;

              return (
                <div key={slot.key} id={slotAnchorId(slot.key)}>
                  <div className="sticky top-0 bg-background border-b py-2 mb-3 z-10">
                    <span className="text-sm font-semibold">{slot.day}</span>
                    <span className="text-sm text-muted-foreground ml-2">
                      {formatTime(slot.startTime)} – {formatTime(slot.endTime)}
                    </span>
                    <span className="text-xs text-muted-foreground ml-2">
                      ({visibleWorkshops.length} workshops)
                    </span>
                  </div>
                  <div className="space-y-2">
                    {visibleWorkshops.map((w) => {
                      const sel = selectionMap.get(w.id);

                      return (
                        <WorkshopCard
                          key={w.slug}
                          workshop={w}
                          selectionType={sel?.type ?? null}
                          speakerCount={w.speakerSlug ? speakerCount.get(w.speakerSlug) : undefined}
                          onAdd={() => {
                            const hasPrimary = (selections[slot.key] ?? []).some((s) => s.type === "primary");
                            selectWorkshop(slot.key, w.id, hasPrimary ? "secondary" : "primary");
                          }}
                          onRemove={() => removeWorkshop(sel!.slotKey, w.id)}
                          onClickTitle={() => openWorkshopModal(w)}
                          onClickSpeaker={() => openSpeakerModal(w.speakerSlug)}
                        />
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
          </div>
        </div>

        {/* Right: User schedule — desktop only */}
        <aside className="hidden lg:flex w-72 border-l bg-muted/30 shrink-0 flex-col overflow-hidden">
          {renderScheduleSidebar()}
        </aside>
      </div>

      <ImportScheduleDialog
        open={!!pendingShare}
        schedule={pendingShare}
        timeSlots={timeSlots}
        allWorkshops={allWorkshops}
        onConfirm={handleImportConfirm}
        onCancel={() => setPendingShare(null)}
      />
    </>
  );
}
