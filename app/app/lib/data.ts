export const SPEAKER_PHOTO_BASE_URL = "https://greathomeschoolconventions.com/images/speakers/";

import locationsRaw from "@data/locations.json";
import eventsRaw from "@data/events.json";
import speakersRaw from "@data/speakers.json";
import tracksRaw from "@data/tracks.json";
import workshopsRaw from "@data/workshops.json";

import type {
  GhcEvent,
  Location,
  Speaker,
  TimeSlot,
  Track,
  Workshop,
  WorkshopWithSchedule,
} from "./types";

const locations = locationsRaw as Location[];
const events = eventsRaw as GhcEvent[];
const speakers = speakersRaw as Speaker[];
const tracks = tracksRaw as Track[];
const workshops = workshopsRaw as Workshop[];

export function getLocations(): Location[] {
  return locations;
}

export function getLocation(slug: string): Location {
  const loc = locations.find((l) => l.slug === slug);
  if (!loc) throw new Response("Location not found", { status: 404 });
  return loc;
}

export function getWorkshopsForLocation(locationSlug: string): WorkshopWithSchedule[] {
  return workshops
    .filter((w) => w.locationSlugs.includes(locationSlug) && w.schedule[locationSlug])
    .map((w) => ({ ...w, scheduleEntry: w.schedule[locationSlug] }));
}

export function getWorkshopTimeSlots(locationSlug: string): TimeSlot[] {
  const locationWorkshops = getWorkshopsForLocation(locationSlug);

  const slotMap = new Map<string, TimeSlot>();
  for (const w of locationWorkshops) {
    const { date, day, startTime, endTime } = w.scheduleEntry;
    const key = `${date}|${startTime}`;
    if (!slotMap.has(key)) {
      slotMap.set(key, { key, date, day, startTime, endTime, workshops: [] });
    }
    slotMap.get(key)!.workshops.push(w);
  }

  return Array.from(slotMap.values()).sort((a, b) => {
    if (a.date !== b.date) return a.date.localeCompare(b.date);
    return a.startTime.localeCompare(b.startTime);
  });
}

export function getSpeakersForLocation(locationSlug: string): Speaker[] {
  return speakers.filter((s) => s.locationSlugs.includes(locationSlug));
}

export function getTracksForLocation(locationSlug: string): Track[] {
  const trackSlugsInUse = new Set(
    workshops
      .filter((w) => w.locationSlugs.includes(locationSlug) && w.trackSlug)
      .map((w) => w.trackSlug as string)
  );
  return tracks.filter((t) => trackSlugsInUse.has(t.slug));
}

export function getEventsForLocation(locationSlug: string): GhcEvent[] {
  return events.filter((e) => e.locationSlug === locationSlug);
}

export function getWorkshop(slug: string, locationSlug: string): WorkshopWithSchedule {
  const w = workshops.find(
    (w) => w.slug === slug && w.locationSlugs.includes(locationSlug)
  );
  if (!w || !w.schedule[locationSlug]) {
    throw new Response("Workshop not found", { status: 404 });
  }
  return { ...w, scheduleEntry: w.schedule[locationSlug] };
}

export function getSpeaker(slug: string, locationSlug: string): Speaker {
  const s = speakers.find(
    (s) => s.slug === slug && s.locationSlugs.includes(locationSlug)
  );
  if (!s) throw new Response("Speaker not found", { status: 404 });
  return s;
}

export function getTrack(slug: string): Track | undefined {
  return tracks.find((t) => t.slug === slug);
}

export function getAllTracks(): Track[] {
  return tracks;
}

export function getWorkshopById(id: string): Workshop | undefined {
  return workshops.find((w) => w.id === id);
}

export function getRoomsForLocation(locationSlug: string): string[] {
  const rooms = new Set<string>();
  for (const w of workshops) {
    if (w.locationSlugs.includes(locationSlug) && w.schedule[locationSlug]) {
      rooms.add(w.schedule[locationSlug].room);
    }
  }
  return Array.from(rooms).sort();
}
