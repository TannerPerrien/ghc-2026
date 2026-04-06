import { useState } from "react";
import { X } from "lucide-react";
import { cn } from "~/lib/utils";
import { Input } from "~/components/ui/input";
import { Button } from "~/components/ui/button";
import { Checkbox } from "~/components/ui/checkbox";
import { TrackBadge } from "~/components/track-badge";
import type { FilterState, Speaker, Track } from "~/lib/types";

interface FilterSidebarProps {
  tracks: Track[];
  speakers: Speaker[];
  rooms: string[];
  filters: FilterState;
  onFiltersChange: (filters: FilterState) => void;
}

function FilterSection({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col flex-1 min-h-0">
      <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-2 shrink-0">
        {title}
      </h3>
      {children}
    </div>
  );
}

function CheckItem({
  id,
  checked,
  onToggle,
  children,
}: {
  id: string;
  checked: boolean;
  onToggle: () => void;
  children: React.ReactNode;
}) {
  return (
    <div className="flex items-center gap-2 py-1 group">
      <Checkbox
        id={id}
        checked={checked}
        onCheckedChange={onToggle}
        className="shrink-0"
      />
      <label
        htmlFor={id}
        className={cn(
          "flex-1 min-w-0 text-sm cursor-pointer select-none",
          checked ? "text-foreground" : "text-muted-foreground group-hover:text-foreground"
        )}
      >
        {children}
      </label>
    </div>
  );
}

export function FilterSidebar({
  tracks,
  speakers,
  rooms,
  filters,
  onFiltersChange,
}: FilterSidebarProps) {
  const [speakerSearch, setSpeakerSearch] = useState("");

  const hasActiveFilters =
    filters.tracks.size > 0 ||
    filters.speakers.size > 0 ||
    filters.rooms.size > 0 ||
    filters.search.length > 0;

  function toggleSet<T extends string>(
    set: Set<T>,
    value: T,
    key: keyof FilterState
  ) {
    const next = new Set(set);
    if (next.has(value)) next.delete(value);
    else next.add(value);
    onFiltersChange({ ...filters, [key]: next });
  }

  function clearAll() {
    setSpeakerSearch("");
    onFiltersChange({
      tracks: new Set(),
      speakers: new Set(),
      rooms: new Set(),
      search: "",
    });
  }

  const filteredSpeakers = speakerSearch
    ? speakers.filter((s) =>
        s.name.toLowerCase().includes(speakerSearch.toLowerCase())
      )
    : speakers;

  return (
    <div className="h-full flex flex-col">
      <div className="flex items-center justify-between mb-3">
        <h2 className="font-semibold text-sm uppercase tracking-wide text-muted-foreground">
          Filters
        </h2>
        <Button
          variant="ghost"
          size="sm"
          className={cn(
            "h-6 px-2 text-xs text-muted-foreground hover:text-foreground",
            !hasActiveFilters && "invisible pointer-events-none"
          )}
          onClick={clearAll}
          tabIndex={hasActiveFilters ? 0 : -1}
        >
          <X className="size-3 mr-1" />
          Clear
        </Button>
      </div>

      {/* Free-text search */}
      <div className="mb-4">
        <Input
          placeholder="Search workshops…"
          value={filters.search}
          onChange={(e) =>
            onFiltersChange({ ...filters, search: e.target.value })
          }
          className="h-7 text-xs"
        />
      </div>

      <div className="flex-1 flex flex-col min-h-0 divide-y">
        {/* Tracks */}
        {tracks.length > 0 && (
          <div className="flex flex-col min-h-0 max-h-1/3 py-3 first:pt-0">
            <FilterSection title={`Tracks (${tracks.length})`}>
              <div className="overflow-y-auto space-y-0.5">
                {tracks.map((track) => (
                  <CheckItem
                    key={track.slug}
                    id={`filter-track-${track.slug}`}
                    checked={filters.tracks.has(track.slug)}
                    onToggle={() => toggleSet(filters.tracks, track.slug, "tracks")}
                  >
                    <TrackBadge trackSlug={track.slug} size="sm" />
                  </CheckItem>
                ))}
              </div>
            </FilterSection>
          </div>
        )}

        {/* Speakers */}
        {speakers.length > 0 && (
          <div className="flex-1 flex flex-col min-h-0 py-3">
            <FilterSection title={`Speakers (${speakers.length})`}>
              <Input
                placeholder="Find speaker…"
                value={speakerSearch}
                onChange={(e) => setSpeakerSearch(e.target.value)}
                className="h-6 text-xs mb-2 shrink-0"
              />
              <div className="overflow-y-auto space-y-0.5">
                {filteredSpeakers.map((speaker) => (
                  <CheckItem
                    key={speaker.slug}
                    id={`filter-speaker-${speaker.slug}`}
                    checked={filters.speakers.has(speaker.slug)}
                    onToggle={() =>
                      toggleSet(filters.speakers, speaker.slug, "speakers")
                    }
                  >
                    {speaker.name}
                  </CheckItem>
                ))}
                {filteredSpeakers.length === 0 && (
                  <p className="text-xs text-muted-foreground py-1">No speakers found</p>
                )}
              </div>
            </FilterSection>
          </div>
        )}

        {/* Rooms */}
        {rooms.length > 0 && (
          <div className="flex-1 flex flex-col min-h-0 py-3">
            <FilterSection title={`Rooms (${rooms.length})`}>
              <div className="overflow-y-auto space-y-0.5">
                {rooms.map((room) => (
                  <CheckItem
                    key={room}
                    id={`filter-room-${room.replace(/\s+/g, "-").toLowerCase()}`}
                    checked={filters.rooms.has(room)}
                    onToggle={() => toggleSet(filters.rooms, room, "rooms")}
                  >
                    {room}
                  </CheckItem>
                ))}
              </div>
            </FilterSection>
          </div>
        )}
      </div>
    </div>
  );
}
