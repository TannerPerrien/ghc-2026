import type { ScheduleSelections, WorkshopWithSchedule } from "./types";

/** Returns a map of speakerSlug → number of selected workshops featuring that speaker. */
export function buildSpeakerCount(
  selections: ScheduleSelections,
  allWorkshops: WorkshopWithSchedule[]
): Map<string, number> {
  const counts = new Map<string, number>();
  for (const slotSelections of Object.values(selections)) {
    for (const sel of slotSelections) {
      const w = allWorkshops.find((w) => w.id === sel.workshopId);
      if (w?.speakerSlug) {
        counts.set(w.speakerSlug, (counts.get(w.speakerSlug) ?? 0) + 1);
      }
    }
  }
  return counts;
}
