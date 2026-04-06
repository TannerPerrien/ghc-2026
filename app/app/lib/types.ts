export interface Location {
  slug: string;
  name: string;
  abbreviation: string;
  venue: string;
  city: string;
  address: string;
  dates: { start: string; end: string };
  year: number;
}

export interface Track {
  slug: string;
  name: string;
}

export interface Speaker {
  slug: string;
  name: string;
  title: string | null;
  website: string | null;
  photoFilename: string | null;
  bio: string | null;
  locationSlugs: string[];
  trackSlugs: string[];
  workshopSlugs: string[];
}

export interface ScheduleEntry {
  date: string;
  day: string;
  startTime: string;
  endTime: string;
  room: string;
}

export interface Workshop {
  id: string;
  slug: string;
  title: string;
  speakerSlug: string | null;
  speakerName: string | null;
  trackSlug: string | null;
  locationSlugs: string[];
  description: string | null;
  schedule: Record<string, ScheduleEntry>;
}

export interface GhcEvent {
  title: string;
  locationSlug: string;
  date: string;
  day: string;
  startTime: string;
  endTime: string | null;
  room: string | null;
  description: string | null;
}

/** Workshop with the schedule entry for a specific location extracted for convenience */
export interface WorkshopWithSchedule extends Workshop {
  scheduleEntry: ScheduleEntry;
}

/** Workshops grouped by time slot (date + startTime) */
export interface TimeSlot {
  key: string; // "date|startTime"
  date: string;
  day: string;
  startTime: string;
  endTime: string;
  workshops: WorkshopWithSchedule[];
}

// ── Scheduling state ──────────────────────────────────────────────────────────

export type SelectionType = "primary" | "secondary";

export interface WorkshopSelection {
  workshopId: string;
  type: SelectionType;
}

/** All workshop selections for a location, keyed by TimeSlot.key ("date|startTime") */
export type ScheduleSelections = Record<string, WorkshopSelection[]>;

/** A portable snapshot shared via URL */
export interface SharedSchedule {
  userId: string;
  locationSlug: string;
  selections: ScheduleSelections;
  sharedAt: string;
  displayName?: string;
}

/** Full persisted state in localStorage */
export interface AppState {
  userId: string;
  schedules: Record<string, ScheduleSelections>;
  importedSchedules: SharedSchedule[];
}

/** Ephemeral filter state (not persisted) */
export interface FilterState {
  tracks: Set<string>;
  speakers: Set<string>;
  rooms: Set<string>;
  search: string;
}
