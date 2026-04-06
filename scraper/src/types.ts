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
  date: string;       // ISO date e.g. "2026-04-09"
  day: string;        // "Thursday" | "Friday" | "Saturday"
  startTime: string;  // 24h e.g. "14:30"
  endTime: string;    // 24h e.g. "15:30"
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
  schedule: Record<string, ScheduleEntry>;  // keyed by location slug
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

// Intermediate types used during scraping
export interface WorkshopStub {
  id: string;
  slug: string;
  title: string;
  speakerSlug: string | null;
  speakerName: string | null;
  trackName: string | null;
}

export interface SpeakerStub {
  slug: string;
  name: string;
  photoFilename: string | null;
}
